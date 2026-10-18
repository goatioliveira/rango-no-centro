import type { LatLng } from "./types";
import { CENTRO } from "./format";

/** Retângulo em volta do Centro do Rio (lon mín, lat mín, lon máx, lat máx), com folga. */
const BBOX = [-43.215, -22.93, -43.16, -22.885] as const;

export type Lugar = {
  id: string;
  nome: string;
  endereco: string;
  lat: number;
  lng: number;
  tipo?: string;
};

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_id?: number;
    osm_type?: string;
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
  return {
    id: `${p.osm_type ?? "x"}${p.osm_id ?? i}`,
    nome: p.name ?? endereco ?? "Sem nome",
    endereco,
    lat,
    lng,
    tipo: p.osm_value,
  };
}

/**
 * Busca com autocompletar pelo Photon (OpenStreetMap, feito para isso).
 * Resultados restritos ao Centro.
 */
export async function buscarPhoton(q: string, signal?: AbortSignal): Promise<Lugar[]> {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", q);
  url.searchParams.set("bbox", BBOX.join(","));
  url.searchParams.set("lat", String(CENTRO.lat));
  url.searchParams.set("lon", String(CENTRO.lng));
  url.searchParams.set("limit", "8");
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Photon ${res.status}`);
  const json = (await res.json()) as { features: PhotonFeature[] };
  return json.features.map(photonParaLugar);
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
  type?: string;
  address?: { road?: string; house_number?: string; suburb?: string };
};

export async function buscarNominatim(q: string, signal?: AbortSignal): Promise<Lugar[]> {
  await esperarVezNominatim();
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("viewbox", `${BBOX[0]},${BBOX[3]},${BBOX[2]},${BBOX[1]}`);
  url.searchParams.set("bounded", "1");
  url.searchParams.set("limit", "8");
  url.searchParams.set("accept-language", "pt-BR");
  // O navegador envia o Referer do site automaticamente (identificação exigida pelo Nominatim).
  const res = await fetch(url, { signal, referrerPolicy: "strict-origin-when-cross-origin" });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const json = (await res.json()) as NominatimItem[];
  return json.map((it) => {
    const a = it.address ?? {};
    const rua = [a.road, a.house_number].filter(Boolean).join(", ");
    return {
      id: `n${it.place_id}`,
      nome: it.name || it.display_name.split(",")[0],
      endereco: [rua, a.suburb].filter(Boolean).join(" – ") || it.display_name.split(",").slice(0, 3).join(","),
      lat: Number(it.lat),
      lng: Number(it.lon),
      tipo: it.type,
    };
  });
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
