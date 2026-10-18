"use client";

import { useMemo, useState } from "react";
import { Dices, Search, SlidersHorizontal, Star } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { PainelFiltros } from "@/components/Filtros";
import { Botao, Chip, NotaBadge, Vazio, cx, inputCls } from "@/components/ui";
import {
  aplicarFiltros,
  contarFiltros,
  distanciaM,
  faixaPrecoLabel,
  formatData,
  formatDistancia,
  formatPreco,
  ordenar,
} from "@/lib/format";
import { minhaPosicao } from "@/lib/geo";
import type { SortKey } from "@/lib/types";
import { EMPTY_FILTERS } from "@/lib/types";

const ORDENS: { key: SortKey; label: string }[] = [
  { key: "nota", label: "Melhor nota" },
  { key: "avaliados", label: "Mais avaliados" },
  { key: "barato", label: "Mais barato" },
  { key: "recente", label: "Mais recente" },
  { key: "perto", label: "Mais perto" },
];

export default function ListaPage() {
  const app = useApp();
  const { restaurantes, filtros, setFiltros, carregandoDados, minhaPos } = app;
  const [ordem, setOrdem] = useState<SortKey>("nota");
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  const lista = useMemo(
    () => ordenar(aplicarFiltros(restaurantes, filtros), ordem, minhaPos),
    [restaurantes, filtros, ordem, minhaPos],
  );
  const nFiltros = contarFiltros(filtros);

  async function escolherOrdem(k: SortKey) {
    setOrdem(k);
    if (k === "perto" && !minhaPos) {
      try {
        app.setMinhaPos(await minhaPosicao());
      } catch (e) {
        app.avisar((e as Error).message, "erro");
        setOrdem("nota");
      }
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <header className="calcadao pt-safe sticky top-0 z-10 border-b border-line">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <h1 className="font-display text-3xl font-extrabold">Lista</h1>
            <button
              type="button"
              onClick={() => app.setSorteioAberto(true)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-2xl bg-surface px-3 text-sm font-semibold shadow-soft"
            >
              <Dices className="size-5" /> Sorteia
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" />
              <input
                className={`${inputCls} bg-surface pl-12`}
                placeholder="Buscar por nome"
                aria-label="Buscar por nome"
                type="search"
                value={filtros.busca}
                onChange={(e) => setFiltros((f) => ({ ...f, busca: e.target.value }))}
              />
            </div>
            <button
              type="button"
              onClick={() => setFiltrosAbertos(true)}
              className={cx(
                "relative grid size-12 shrink-0 place-items-center rounded-2xl border",
                nFiltros ? "border-ink bg-ink text-bg" : "border-line bg-surface",
              )}
              aria-label={nFiltros ? `Filtros (${nFiltros} ativos)` : "Filtros"}
            >
              <SlidersHorizontal className="size-5" />
              {nFiltros ? (
                <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-brand text-[11px] font-bold text-brand-ink">
                  {nFiltros}
                </span>
              ) : null}
            </button>
          </div>
          <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4" role="radiogroup" aria-label="Ordenar por">
            {ORDENS.map((o) => (
              <Chip key={o.key} role="radio" aria-checked={ordem === o.key} ativo={ordem === o.key} onClick={() => escolherOrdem(o.key)}>
                {o.label}
              </Chip>
            ))}
          </div>
        </div>
      </header>

      {carregandoDados ? (
        <ul className="flex flex-col gap-3 p-4">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="skeleton h-24 rounded-2xl" />
          ))}
        </ul>
      ) : restaurantes.length === 0 ? (
        <Vazio
          emoji="🍛"
          titulo="Nenhum rango marcado ainda."
          texto="Bora inaugurar o mapa? Marque o lugar onde você almoçou hoje."
          acao={<Botao onClick={() => app.abrirAdicionar()}>Marcar o primeiro</Botao>}
        />
      ) : lista.length === 0 ? (
        <Vazio
          emoji="🔎"
          titulo="Nada com esses filtros"
          texto="Tenta tirar algum filtro ou mudar a busca."
          acao={
            <Botao variant="secundario" onClick={() => setFiltros(EMPTY_FILTERS)}>
              Limpar filtros
            </Botao>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3 p-4">
          <li className="px-1 text-sm text-muted">
            {lista.length} {lista.length === 1 ? "lugar" : "lugares"}
          </li>
          {lista.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => app.abrirRestaurante(r.id, true)}
                className="flex w-full items-center gap-4 rounded-2xl border border-line bg-surface p-4 text-left transition active:scale-[0.99]"
              >
                <NotaBadge nota={r.media} tamanho="lg" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-display text-lg leading-tight font-bold">
                    <span className="truncate">{r.nome}</span>
                    {r.eu_quero ? <Star className="size-4 shrink-0 fill-sun text-sun" aria-label="Na sua lista de quero ir" /> : null}
                  </p>
                  <p className="truncate text-sm text-muted">
                    {[
                      r.num_avaliadores
                        ? `${r.num_avaliadores} ${r.num_avaliadores === 1 ? "avaliação" : "avaliações"}`
                        : "sem avaliação",
                      r.preco_medio != null ? `~${formatPreco(r.preco_medio)}` : faixaPrecoLabel(r.faixa_preco),
                      minhaPos ? formatDistancia(distanciaM(minhaPos, r)) : null,
                      r.ultima_visita && ordem === "recente" ? formatData(r.ultima_visita) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {r.tags.length ? (
                    <p className="mt-1 truncate text-xs text-muted">{r.tags.join(" · ")}</p>
                  ) : null}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <PainelFiltros aberto={filtrosAbertos} onFechar={() => setFiltrosAbertos(false)} total={lista.length} />
    </div>
  );
}
