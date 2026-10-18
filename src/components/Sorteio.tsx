"use client";

import { useState } from "react";
import { Dices } from "lucide-react";
import { aplicarFiltros, contarFiltros, faixaPrecoLabel, formatPreco } from "@/lib/format";
import type { Restaurant } from "@/lib/types";
import { useApp } from "./AppProvider";
import { Botao, NotaBadge, Sheet } from "./ui";

const NOTA_MINIMA = 7;

function sortear(lista: Restaurant[], evitar?: string): Restaurant | null {
  const opcoes = lista.length > 1 && evitar ? lista.filter((r) => r.id !== evitar) : lista;
  if (!opcoes.length) return null;
  return opcoes[Math.floor(Math.random() * opcoes.length)];
}

export function Sorteio() {
  const app = useApp();
  const candidatos = aplicarFiltros(app.restaurantes, app.filtros).filter((r) => (r.media ?? 0) >= NOTA_MINIMA);
  const [escolhido, setEscolhido] = useState<Restaurant | null>(() => sortear(candidatos));
  const [girando, setGirando] = useState(false);

  function deNovo() {
    setGirando(true);
    setTimeout(() => {
      setEscolhido(sortear(candidatos, escolhido?.id));
      setGirando(false);
    }, 450);
  }

  const fechar = () => app.setSorteioAberto(false);

  return (
    <Sheet aberto onFechar={fechar} titulo={<h2 className="font-display text-2xl font-extrabold">Sorteia um almoço 🎲</h2>}>
      <div className="flex flex-col gap-4 pt-2 pb-2">
        {!escolhido ? (
          <div className="py-6 text-center">
            <p className="text-4xl">🤷</p>
            <p className="mt-2 font-semibold">Nenhum lugar com nota {NOTA_MINIMA}+ {contarFiltros(app.filtros) ? "nesses filtros" : "ainda"}.</p>
            <p className="text-sm text-muted">Avalie mais lugares ou afrouxe os filtros.</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted">
              Entre {candidatos.length} {candidatos.length === 1 ? "lugar" : "lugares"} com nota {NOTA_MINIMA}+
              {contarFiltros(app.filtros) ? " (nos seus filtros)" : ""}, hoje é dia de:
            </p>
            <div className={`flex items-center gap-4 rounded-3xl bg-surface-2 p-5 transition ${girando ? "scale-95 opacity-40" : ""}`}>
              <NotaBadge nota={escolhido.media} tamanho="xl" />
              <div className="min-w-0">
                <p className="font-display text-2xl leading-tight font-extrabold">{escolhido.nome}</p>
                <p className="text-sm text-muted">
                  {[faixaPrecoLabel(escolhido.faixa_preco), escolhido.preco_medio != null ? `~${formatPreco(escolhido.preco_medio)}` : ""]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Botao variant="secundario" onClick={deNovo} disabled={candidatos.length < 2 || girando} className="flex-1">
                <Dices className="size-5" /> De novo
              </Botao>
              <Botao
                className="flex-1"
                onClick={() => {
                  fechar();
                  app.abrirRestaurante(escolhido.id, true);
                }}
              >
                Bora! 🍽️
              </Botao>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}
