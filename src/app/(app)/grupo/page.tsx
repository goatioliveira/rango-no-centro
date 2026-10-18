"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { useApp, mensagemErro } from "@/components/AppProvider";
import { Avatar, NotaBadge, Vazio } from "@/components/ui";
import { tempoAtras } from "@/lib/format";

type Atividade =
  | { tipo: "review"; quando: string; userId: string; restauranteId: string; nota: number; comentario: string | null }
  | { tipo: "novo"; quando: string; userId: string | null; restauranteId: string };

type ReviewMin = { user_id: string; restaurant_id: string };

export default function GrupoPage() {
  const app = useApp();
  const { membros, restaurantes, versao } = app;
  const [todas, setTodas] = useState<ReviewMin[] | null>(null);
  const [recentes, setRecentes] = useState<
    { id: string; user_id: string; restaurant_id: string; nota_geral: number; comentario: string | null; created_at: string }[]
  >([]);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const supabase = getSupabase();
      const [a, b] = await Promise.all([
        supabase.from("reviews").select("user_id, restaurant_id"),
        supabase
          .from("reviews")
          .select("id, user_id, restaurant_id, nota_geral, comentario, created_at")
          .order("created_at", { ascending: false })
          .limit(30),
      ]);
      if (!vivo) return;
      if (a.error || b.error) {
        setErro(mensagemErro(a.error ?? b.error));
        return;
      }
      setTodas(a.data as ReviewMin[]);
      setRecentes(b.data ?? []);
    })();
    return () => {
      vivo = false;
    };
  }, [versao]);

  const ranking = useMemo(() => {
    if (!todas) return [];
    const lugares = new Map<string, Set<string>>();
    const visitas = new Map<string, number>();
    for (const r of todas) {
      if (!lugares.has(r.user_id)) lugares.set(r.user_id, new Set());
      lugares.get(r.user_id)!.add(r.restaurant_id);
      visitas.set(r.user_id, (visitas.get(r.user_id) ?? 0) + 1);
    }
    return membros
      .filter((m) => m.is_member && !m.is_blocked)
      .map((m) => ({ m, lugares: lugares.get(m.id)?.size ?? 0, visitas: visitas.get(m.id) ?? 0 }))
      .sort((a, b) => b.lugares - a.lugares || b.visitas - a.visitas);
  }, [todas, membros]);

  const feed: Atividade[] = useMemo(() => {
    const itens: Atividade[] = [
      ...recentes.map(
        (r): Atividade => ({
          tipo: "review",
          quando: r.created_at,
          userId: r.user_id,
          restauranteId: r.restaurant_id,
          nota: r.nota_geral,
          comentario: r.comentario,
        }),
      ),
      ...[...restaurantes]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 20)
        .map((r): Atividade => ({ tipo: "novo", quando: r.created_at, userId: r.criado_por, restauranteId: r.id })),
    ];
    return itens.sort((a, b) => b.quando.localeCompare(a.quando)).slice(0, 40);
  }, [recentes, restaurantes]);

  const nome = (id: string | null) => membros.find((m) => m.id === id)?.apelido ?? "Alguém";
  const membro = (id: string | null) => membros.find((m) => m.id === id);
  const restaurante = (id: string) => restaurantes.find((r) => r.id === id);
  const medalha = ["🥇", "🥈", "🥉"];

  return (
    <div className="mx-auto max-w-xl">
      <header className="calcadao pt-safe border-b border-line">
        <div className="px-4 pt-4 pb-4">
          <h1 className="font-display text-3xl font-extrabold">Grupo</h1>
          <p className="text-muted">
            {ranking.length} {ranking.length === 1 ? "pessoa" : "pessoas"} · {restaurantes.length}{" "}
            {restaurantes.length === 1 ? "lugar" : "lugares"} no mapa
          </p>
        </div>
      </header>

      {erro ? (
        <p role="alert" className="m-4 rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {erro}
        </p>
      ) : null}

      <section className="p-4">
        <h2 className="mb-3 font-display text-xl font-bold">Quem mais desbrava o Centro</h2>
        {todas == null ? (
          <div className="skeleton h-40 rounded-2xl" />
        ) : (
          <ol className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
            {ranking.map(({ m, lugares, visitas }, i) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                <span className="w-7 text-center font-display text-lg font-bold text-muted">{lugares > 0 ? (medalha[i] ?? i + 1) : "–"}</span>
                <Avatar url={m.avatar_url} nome={m.apelido} tamanho={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {m.apelido}
                    {m.id === app.userId ? <span className="font-normal text-muted"> (você)</span> : null}
                  </p>
                  <p className="text-xs text-muted">
                    {visitas} {visitas === 1 ? "avaliação" : "avaliações"}
                  </p>
                </div>
                <span className="text-right">
                  <span className="block font-display text-2xl leading-none font-extrabold">{lugares}</span>
                  <span className="text-xs text-muted">{lugares === 1 ? "lugar" : "lugares"}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="p-4 pt-2">
        <h2 className="mb-3 font-display text-xl font-bold">Últimas da galera</h2>
        {feed.length === 0 && todas != null ? (
          <Vazio emoji="🦗" titulo="Tudo quieto por aqui" texto="Quando alguém marcar ou avaliar um lugar, aparece aqui." />
        ) : (
          <ul className="flex flex-col gap-2">
            {feed.map((a, i) => {
              const r = restaurante(a.restauranteId);
              if (!r) return null;
              const m = membro(a.userId);
              return (
                <li key={`${a.tipo}-${a.restauranteId}-${a.quando}-${i}`}>
                  <button
                    type="button"
                    onClick={() => app.abrirRestaurante(r.id)}
                    className="flex w-full items-start gap-3 rounded-2xl p-3 text-left hover:bg-surface"
                  >
                    <Avatar url={m?.avatar_url} nome={m?.apelido ?? "?"} tamanho={36} />
                    <div className="min-w-0 flex-1 text-[15px]">
                      <p>
                        <b>{nome(a.userId)}</b> {a.tipo === "review" ? "avaliou" : "marcou no mapa"} <b>{r.nome}</b>
                      </p>
                      {a.tipo === "review" && a.comentario ? (
                        <p className="line-clamp-2 text-sm text-muted">“{a.comentario}”</p>
                      ) : null}
                      <p className="text-xs text-muted">{tempoAtras(a.quando)}</p>
                    </div>
                    {a.tipo === "review" ? <NotaBadge nota={a.nota} tamanho="sm" /> : <span className="text-xl">📍</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
