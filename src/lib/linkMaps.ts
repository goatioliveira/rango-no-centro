// Leitura de links do Google Maps (o que o app gera em "Compartilhar → Copiar link").
// Funções puras: rodam tanto no servidor quanto no navegador.

/** Domínios aceitos (o servidor só segue redirecionamentos para eles). */
const HOSTS_GOOGLE = /^(?:maps\.app\.goo\.gl|goo\.gl|g\.co|(?:www\.|maps\.)?google\.(?:com|com\.br)|consent\.google\.com)$/i;

export function ehHostGoogleMaps(host: string): boolean {
  return HOSTS_GOOGLE.test(host);
}

/** Acha um link do Google Maps dentro de um texto colado (o iPhone cola "Nome do lugar\nhttps://..."). */
export function extrairLinkMaps(texto: string): { url: string; textoAntes: string } | null {
  const m = texto.match(/https?:\/\/[^\s<>"']+/i);
  if (!m) return null;
  try {
    const u = new URL(m[0]);
    if (!ehHostGoogleMaps(u.hostname)) return null;
    if (/^(?:www\.)?google\./i.test(u.hostname) && !u.pathname.startsWith("/maps")) return null;
    if (u.hostname === "goo.gl" && !u.pathname.startsWith("/maps")) return null;
  } catch {
    return null;
  }
  return { url: m[0], textoAntes: texto.slice(0, m.index).trim() };
}

export type DadosLink = {
  nome?: string;
  endereco?: string;
  lat?: number;
  lng?: number;
  /** Texto livre (nome + endereço) para tentar achar o lugar quando o link não tem coordenadas. */
  consulta?: string;
};

function decodificar(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, " ")).trim();
  } catch {
    return s.replace(/\+/g, " ").trim();
  }
}

function coordValida(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
}

const RE_PAR = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;

/** "Bar Luiz, R. da Carioca, 39 - Centro, Rio de Janeiro - RJ" → nome + endereço. */
function separarNomeEndereco(texto: string): { nome?: string; endereco?: string } {
  const partes = texto.split(",").map((p) => p.trim()).filter(Boolean);
  if (!partes.length) return {};
  const pareceEndereco = (p: string) => /^(r\.|rua|av\.?|avenida|pra[çc]a|p[çc]a\.?|trav\.?|travessa|largo|beco|estr\.?|estrada|rod\.?)\s/i.test(p);
  if (pareceEndereco(partes[0])) return { endereco: limparEndereco(partes.join(", ")) };
  return { nome: partes[0], endereco: partes.length > 1 ? limparEndereco(partes.slice(1).join(", ")) : undefined };
}

/** Tira o "Rio de Janeiro - RJ, CEP, Brasil" do fim para ficar curto como os outros endereços do app. */
function limparEndereco(e: string): string {
  return e
    .replace(/,?\s*\d{5}-?\d{3}\b/g, "")
    .replace(/,?\s*(Brasil|Brazil)\s*$/i, "")
    .replace(/,?\s*Rio de Janeiro\s*-\s*RJ\s*$/i, "")
    .replace(/\s+-\s+/g, " – ")
    .replace(/[,\s]+$/, "")
    .trim();
}

/** Lê nome, endereço e coordenadas de uma URL completa do Google Maps (já sem encurtador). */
export function lerUrlGoogleMaps(urlTexto: string): DadosLink {
  let url: URL;
  try {
    url = new URL(urlTexto);
  } catch {
    return {};
  }

  // Tela de consentimento de cookies: o link verdadeiro vem em "continue".
  if (/^consent\.google\./i.test(url.hostname) && url.searchParams.get("continue")) {
    return lerUrlGoogleMaps(url.searchParams.get("continue")!);
  }

  const dados: DadosLink = {};
  const caminho = url.pathname;

  // 1) Coordenadas exatas do lugar: ...!3d-22.9047!4d-43.1786
  const exata = urlTexto.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (exata && coordValida(+exata[1], +exata[2])) {
    dados.lat = +exata[1];
    dados.lng = +exata[2];
  }

  // 2) /maps/place/Nome+do+Lugar/@lat,lng,17z
  const place = caminho.match(/\/maps\/place\/([^/]+)/);
  if (place) {
    const texto = decodificar(place[1]);
    if (RE_PAR.test(texto)) {
      const [, la, ln] = texto.match(RE_PAR)!;
      if (dados.lat == null && coordValida(+la, +ln)) Object.assign(dados, { lat: +la, lng: +ln });
    } else {
      Object.assign(dados, separarNomeEndereco(texto));
      dados.consulta = texto;
    }
  }

  // 3) Parâmetros ?q= / ?query= / ?ll= / ?center=
  for (const chave of ["q", "query", "ll", "center", "destination", "daddr"]) {
    const v = url.searchParams.get(chave);
    if (!v) continue;
    const par = v.match(RE_PAR);
    if (par) {
      if (dados.lat == null && coordValida(+par[1], +par[2])) Object.assign(dados, { lat: +par[1], lng: +par[2] });
    } else if (!dados.nome && !dados.endereco) {
      const texto = v.trim();
      Object.assign(dados, separarNomeEndereco(texto));
      dados.consulta = texto;
    }
  }

  // 4) Último recurso: centro da tela do mapa (@lat,lng,zoom).
  if (dados.lat == null) {
    const arroba = caminho.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (arroba && coordValida(+arroba[1], +arroba[2])) Object.assign(dados, { lat: +arroba[1], lng: +arroba[2] });
  }

  // /maps/search/Nome+do+lugar
  if (!dados.nome && !dados.endereco) {
    const busca = caminho.match(/\/maps\/search\/([^/@]+)/);
    if (busca) {
      const texto = decodificar(busca[1]);
      if (!RE_PAR.test(texto)) {
        Object.assign(dados, separarNomeEndereco(texto));
        dados.consulta = texto;
      }
    }
  }

  return dados;
}

/** Expande abreviações comuns de endereço para a busca do OpenStreetMap entender. */
export function expandirAbreviacoes(q: string): string {
  return q
    .replace(/\bR\.\s*/gi, "Rua ")
    .replace(/\bAv\.?\s+/gi, "Avenida ")
    .replace(/\bP[çc]a?\.?\s+/gi, "Praça ")
    .replace(/\bTrav\.?\s+/gi, "Travessa ")
    .replace(/\bLgo\.?\s+/gi, "Largo ")
    .replace(/\bPres\.?\s+/gi, "Presidente ")
    .replace(/\bMal\.?\s+/gi, "Marechal ")
    .replace(/\bGal\.?\s+/gi, "General ")
    .replace(/\bDr\.?\s+/gi, "Doutor ")
    .replace(/\bVisc\.?\s+/gi, "Visconde ")
    .replace(/\bs\/n\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}
