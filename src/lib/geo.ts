import type { LatLng } from "./types";
import { CENTRO, normalizar } from "./format";
import { expandirAbreviacoes } from "./linkMaps";

/** Retângulos (lon mín, lat mín, lon máx, lat máx): Centro com folga e município do Rio. */
const BBOX = [-43.215, -22.93, -43.16, -22.885] as const;
const BBOX_RIO = [-43.8, -23.08, -43.1, -22.75] as const;

export type Lugar = {
  id: string;
  nome: string;
  endereco: string;
  lat: number;
  lng: number;
  /** Tipo em português, quando é um lugar de comer (Restaurante, Bar, Café…). */
  tipo?: string;
  /** Resultado é só um endereço (rua/número), não um estabelecimento. */
  ehEndereco?: boolean;
};

const TIPOS_COMIDA: Record<string, string> = {
  restaurant: "Restaurante",
  fast_food: "Lanchonete",
  cafe: "Café",
  bar: "Bar",
  pub: "Bar",
  biergarten: "Bar",
  ice_cream: "Sorveteria",
  food_court: "Praça de alimentação",
  bakery: "Padaria",
  pastry: "Confeitaria",
  confectionery: "Doceria",
  deli: "Delicatessen",
};

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_id?: number;
    osm_type?: string;
    osm_key?: string;
    osm_value?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    locality?: string;
    city?: string;
  };
};

function enderecoPhoton(p: PhotonFeature["properties"]): string {
  const rua = [p.street, p.housenumber].filter(Boolean).join(", ");
  const bairro = p.district ?? p.locality;
  return [rua, bairro].filter(Boolean).join(" – ");
}

function photonParaLugar(f: PhotonFeature, i: number): Lugar {
  const [lng, lat] = f.geometry.coordinates;
  const p = f.properties;
  const endereco = enderecoPhoton(p);
  const tipo = p.osm_value ? TIPOS_COMIDA[p.osm_value] : undefined;
  const ehEstabelecimento = Boolean(p.name) && ["amenity", "shop", "tourism", "leisure", "craft", "office"].includes(p.osm_key ?? "");
  const ehEndereco = !ehEstabelecimento;
  const nomeRua = p.name && p.osm_key === "highway" ? p.name : p.street;
  return {
    id: `${p.osm_type ?? "x"}${p.osm_id ?? i}`,
    nome: ehEndereco ? [nomeRua, p.housenumber].filter(Boolean).join(", ") || p.name || endereco : p.name!,
    endereco,
    lat,
    lng,
    tipo,
    ehEndereco,
  };
}

async function photon(q: string, bbox: readonly number[], signal?: AbortSignal): Promise<Lugar[]> {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", q);
  url.searchParams.set("bbox", bbox.join(","));
  url.searchParams.set("lat", String(CENTRO.lat));
  url.searchParams.set("lon", String(CENTRO.lng));
  url.searchParams.set("limit", "10");
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Photon ${res.status}`);
  const json = (await res.json()) as { features: PhotonFeature[] };
  return json.features.map(photonParaLugar);
}

function distCentro(l: Lugar) {
  return Math.hypot(l.lat - CENTRO.lat, (l.lng - CENTRO.lng) * Math.cos((CENTRO.lat * Math.PI) / 180));
}

/** Junta listas, tira repetidos e ordena: lugares de comer primeiro, depois estabelecimentos, depois endereços; perto do Centro antes. */
function juntarResultados(...listas: Lugar[][]): Lugar[] {
  const vistos: Lugar[] = [];
  for (const l of listas.flat()) {
    const repetido = vistos.some(
      (v) => v.id === l.id || (normalizar(v.nome) === normalizar(l.nome) && Math.abs(v.lat - l.lat) < 0.0005 && Math.abs(v.lng - l.lng) < 0.0005),
    );
    if (!repetido) vistos.push(l);
  }
  const peso = (l: Lugar) => (l.tipo ? 0 : l.ehEndereco ? 2 : 1);
  return vistos.sort((a, b) => peso(a) - peso(b) || distCentro(a) - distCentro(b)).slice(0, 10);
}

/**
 * Busca com autocompletar pelo Photon (OpenStreetMap, feito para isso).
 * Procura no Centro e no resto da cidade ao mesmo tempo e entende abreviações ("R.", "Av.", "Pça.").
 */
export async function buscarPhoton(q: string, signal?: AbortSignal): Promise<Lugar[]> {
  const termo = expandirAbreviacoes(q);
  const [centro, rio] = await Promise.all([photon(termo, BBOX, signal), photon(termo, BBOX_RIO, signal).catch(() => [])]);
  return juntarResultados(centro, rio);
}

// Nominatim: no máximo 1 requisição por segundo e só em buscas explícitas
// (política de uso do OpenStreetMap — nada de autocompletar).
let ultimoNominatim = 0;
async function esperarVezNominatim() {
  const espera = ultimoNominatim + 1100 - Date.now();
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  ultimoNominatim = Date.now();
}

type NominatimItem = {
  place_id: number;
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  category?: string;
  type?: string;
  address?: { road?: string; house_number?: string; suburb?: string };
};

export async function buscarNominatim(q: string, signal?: AbortSignal): Promise<Lugar[]> {
  await esperarVezNominatim();
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", expandirAbreviacoes(q));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("viewbox", `${BBOX_RIO[0]},${BBOX_RIO[3]},${BBOX_RIO[2]},${BBOX_RIO[1]}`);
  url.searchParams.set("bounded", "1");
  url.searchParams.set("limit", "10");
  url.searchParams.set("accept-language", "pt-BR");
  // O navegador envia o Referer do site automaticamente (identificação exigida pelo Nominatim).
  const res = await fetch(url, { signal, referrerPolicy: "strict-origin-when-cross-origin" });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const json = (await res.json()) as NominatimItem[];
  const lugares = json.map((it): Lugar => {
    const a = it.address ?? {};
    const rua = [a.road, a.house_number].filter(Boolean).join(", ");
    const ehEndereco = !it.name || ["highway", "place", "building", "boundary"].includes(it.category ?? "");
    return {
      id: `n${it.place_id}`,
      nome: ehEndereco ? rua || it.display_name.split(",")[0] : it.name!,
      endereco: [rua, a.suburb].filter(Boolean).join(" – ") || it.display_name.split(",").slice(0, 3).join(","),
      lat: Number(it.lat),
      lng: Number(it.lon),
      tipo: it.type ? TIPOS_COMIDA[it.type] : undefined,
      ehEndereco,
    };
  });
  return juntarResultados(lugares);
}

/** Descobre o endereço de um ponto do mapa (Photon; se falhar, Nominatim). */
export async function enderecoDoPonto(pos: LatLng): Promise<string> {
  try {
    const url = new URL("https://photon.komoot.io/reverse");
    url.searchParams.set("lat", String(pos.lat));
    url.searchParams.set("lon", String(pos.lng));
    url.searchParams.set("limit", "1");
    const res = await fetch(url);
    if (res.ok) {
      const json = (await res.json()) as { features: PhotonFeature[] };
      const f = json.features[0];
      if (f) {
        const end = enderecoPhoton(f.properties);
        if (end) return end;
      }
    }
  } catch {
    // tenta o Nominatim abaixo
  }
  try {
    await esperarVezNominatim();
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("lat", String(pos.lat));
    url.searchParams.set("lon", String(pos.lng));
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("zoom", "18");
    url.searchParams.set("accept-language", "pt-BR");
    const res = await fetch(url);
    if (!res.ok) return "";
    const it = (await res.json()) as NominatimItem;
    const a = it.address ?? {};
    return [[a.road, a.house_number].filter(Boolean).join(", "), a.suburb].filter(Boolean).join(" – ");
  } catch {
    return "";
  }
}

/** Posição atual do aparelho. */
export function minhaPosicao(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Seu navegador não informa a localização."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? "Você não deixou o app ver sua localização. Libere nas configurações do navegador."
              : "Não deu pra achar sua localização agora.",
          ),
        ),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  });
}
