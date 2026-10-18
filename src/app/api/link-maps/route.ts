import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { ehHostGoogleMaps, expandirAbreviacoes, lerUrlGoogleMaps, type DadosLink } from "@/lib/linkMaps";

// Lê um link do Google Maps colado pela pessoa e devolve nome, endereço e coordenadas.
// Não usa a API paga do Google: só segue o redirecionamento do link curto e lê a URL final.

const USER_AGENT = "RangoNoCentro/1.0 (mapa de almoço de um grupo de amigos)";

/** Retângulo do município do Rio (lon mín, lat mín, lon máx, lat máx) para ajudar a busca por endereço. */
const VIEWBOX_RIO = "-43.80,-22.75,-43.10,-23.08";

async function seguirRedirecionamentos(inicial: string): Promise<string> {
  let atual = inicial;
  for (let i = 0; i < 6; i++) {
    const u = new URL(atual);
    if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("link inválido");
    if (!ehHostGoogleMaps(u.hostname)) throw new Error("o link não é do Google Maps");
    // Links completos já trazem tudo na própria URL; só os curtos precisam ser abertos.
    const curto = /goo\.gl$|^g\.co$/i.test(u.hostname);
    if (!curto) return atual;
    const res = await fetch(atual, {
      redirect: "manual",
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "pt-BR" },
      signal: AbortSignal.timeout(8000),
    });
    const destino = res.headers.get("location");
    if (!destino) throw new Error("não consegui abrir o link");
    atual = new URL(destino, atual).toString();
  }
  return atual;
}

type ItemNominatim = { lat: string; lon: string };

async function geocodificar(texto: string): Promise<{ lat: number; lng: number } | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", texto);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "br");
  url.searchParams.set("viewbox", VIEWBOX_RIO);
  url.searchParams.set("bounded", "1");
  url.searchParams.set("accept-language", "pt-BR");
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  const [item] = (await res.json()) as ItemNominatim[];
  return item ? { lat: Number(item.lat), lng: Number(item.lon) } : null;
}

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return NextResponse.json({ erro: "Entre no app primeiro." }, { status: 401 });

  const link = request.nextUrl.searchParams.get("url") ?? "";
  let final: string;
  try {
    final = await seguirRedirecionamentos(link);
  } catch (e) {
    return NextResponse.json({ erro: `Não consegui ler esse link: ${(e as Error).message}.` }, { status: 400 });
  }

  const dados: DadosLink & { aproximado?: boolean } = lerUrlGoogleMaps(final);

  // Sem coordenadas no link (comum no iPhone): acha o ponto pelo endereço, com a regra de 1 busca por vez.
  if (dados.lat == null) {
    const tentativas = [dados.endereco, dados.consulta].filter((t): t is string => Boolean(t));
    for (const [i, t] of tentativas.entries()) {
      if (i > 0) await new Promise((r) => setTimeout(r, 1100));
      const ponto = await geocodificar(`${expandirAbreviacoes(t)}, Rio de Janeiro`).catch(() => null);
      if (ponto) {
        Object.assign(dados, ponto, { aproximado: true });
        break;
      }
    }
  }

  if (dados.lat == null && !dados.nome) {
    return NextResponse.json({ erro: "Esse link não tem a localização do lugar. Tente copiar o link de novo pelo botão Compartilhar." }, { status: 422 });
  }

  return NextResponse.json({
    nome: dados.nome ?? null,
    endereco: dados.endereco ?? null,
    lat: dados.lat ?? null,
    lng: dados.lng ?? null,
    aproximado: Boolean(dados.aproximado),
  });
}
