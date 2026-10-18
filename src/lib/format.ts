import type { Filters, LatLng, Restaurant, SortKey } from "./types";

export const CENTRO: LatLng = { lat: -22.9035, lng: -43.178 };
export const CENTRO_ZOOM = 16;

export type Faixa = "vermelho" | "laranja" | "amarelo" | "verde" | "cinza";

/** Cor do pin a partir da média. */
export function faixaDaNota(media: number | null | undefined): Faixa {
  if (media == null) return "cinza";
  if (media < 5) return "vermelho";
  if (media < 7) return "laranja";
  if (media < 8.5) return "amarelo";
  return "verde";
}

export const COR_FAIXA: Record<Faixa, { bg: string; fg: string }> = {
  vermelho: { bg: "#D7263D", fg: "#FFFFFF" },
  laranja: { bg: "#EE7B1E", fg: "#FFFFFF" },
  amarelo: { bg: "#F2C230", fg: "#2A2000" },
  verde: { bg: "#1E9A54", fg: "#FFFFFF" },
  cinza: { bg: "#8A8F98", fg: "#FFFFFF" },
};

export function formatNota(n: number | null | undefined): string {
  if (n == null) return "–";
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export function formatPreco(n: number | null | undefined): string {
  if (n == null) return "–";
  return BRL.format(n);
}

export function faixaPrecoLabel(n: number | null | undefined): string {
  return n ? "$".repeat(n) : "";
}

export function formatData(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = iso.length === 10 ? new Date(`${iso}T12:00:00`) : new Date(iso);
  return d
    .toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" })
    .replace(/ de /g, " ")
    .replace(".", "");
}

export function tempoAtras(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "agora há pouco";
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  const dias = Math.floor(diff / 86400);
  if (dias === 1) return "ontem";
  if (dias < 30) return `há ${dias} dias`;
  return formatData(iso);
}

/** Hoje no fuso de Brasília, no formato AAAA-MM-DD. */
export function hojeISO(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

/** Distância em metros (fórmula de haversine). */
export function distanciaM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistancia(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(1).replace(".", ",")} km`;
}

/** Normaliza texto para comparar: minúsculas, sem acento, sem pontuação. */
export function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set(["restaurante", "bar", "lanchonete", "o", "a", "do", "da", "de", "dos", "das", "e", "the"]);

function palavras(s: string): string[] {
  return normalizar(s)
    .split(" ")
    .filter((w) => w.length > 1 && !STOP.has(w));
}

/** Nomes "parecidos": um contém o outro, ou compartilham a maior parte das palavras. */
export function nomesParecidos(a: string, b: string): boolean {
  const na = normalizar(a);
  const nb = normalizar(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 4 && nb.length >= 4 && (na.includes(nb) || nb.includes(na))) return true;
  const pa = palavras(a);
  const pb = new Set(palavras(b));
  if (!pa.length || !pb.size) return false;
  const comuns = pa.filter((w) => pb.has(w)).length;
  return comuns / Math.min(pa.length, pb.size) >= 0.6;
}

/** Possíveis duplicatas: a até 30 m, ou com nome parecido a até 1,5 km. */
export function possiveisDuplicatas(lista: Restaurant[], nome: string, pos: LatLng | null): Restaurant[] {
  return lista
    .map((r) => ({ r, d: pos ? distanciaM(pos, r) : Infinity }))
    .filter(({ r, d }) => d <= 30 || (nome.trim().length >= 3 && nomesParecidos(nome, r.nome) && (!pos || d <= 1500)))
    .sort((x, y) => x.d - y.d)
    .slice(0, 3)
    .map(({ r }) => r);
}

export function aplicarFiltros(lista: Restaurant[], f: Filters): Restaurant[] {
  const busca = normalizar(f.busca);
  return lista.filter((r) => {
    if (busca && !normalizar(`${r.nome} ${r.endereco ?? ""} ${r.tags.join(" ")}`).includes(busca)) return false;
    if (f.tags.length && !f.tags.every((t) => r.tags.includes(t))) return false;
    if (f.precos.length && (r.faixa_preco == null || !f.precos.includes(r.faixa_preco))) return false;
    if (f.notaMin != null && (r.media == null || r.media < f.notaMin)) return false;
    if (f.naoFui && r.eu_fui) return false;
    if (f.queroIr && !r.eu_quero) return false;
    return true;
  });
}

export function contarFiltros(f: Filters): number {
  return f.tags.length + f.precos.length + (f.notaMin != null ? 1 : 0) + (f.naoFui ? 1 : 0) + (f.queroIr ? 1 : 0);
}

export function ordenar(lista: Restaurant[], key: SortKey, pos: LatLng | null): Restaurant[] {
  const arr = [...lista];
  const semNulos = (v: number | null, fallback: number) => (v == null ? fallback : v);
  switch (key) {
    case "nota":
      return arr.sort((a, b) => semNulos(b.media, -1) - semNulos(a.media, -1) || b.num_avaliadores - a.num_avaliadores);
    case "avaliados":
      return arr.sort((a, b) => b.num_avaliacoes - a.num_avaliacoes || semNulos(b.media, -1) - semNulos(a.media, -1));
    case "barato":
      return arr.sort(
        (a, b) =>
          semNulos(a.preco_medio, (a.faixa_preco ?? 9) * 1000) - semNulos(b.preco_medio, (b.faixa_preco ?? 9) * 1000),
      );
    case "recente":
      return arr.sort((a, b) => (b.ultima_visita ?? b.created_at).localeCompare(a.ultima_visita ?? a.created_at));
    case "perto":
      return pos ? arr.sort((a, b) => distanciaM(pos, a) - distanciaM(pos, b)) : arr;
  }
}

export function linkGoogleMaps(r: { lat: number; lng: number }) {
  return `https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}`;
}

export function linkWaze(r: { lat: number; lng: number }) {
  return `https://waze.com/ul?ll=${r.lat},${r.lng}&navigate=yes`;
}

export const VOLTARIA_LABEL = { sim: "Voltaria", nao: "Não voltaria", talvez: "Talvez voltasse" } as const;
