"use client";

import { Search } from "lucide-react";
import { EMPTY_FILTERS } from "@/lib/types";
import { useApp } from "./AppProvider";
import { Botao, Chip, Sheet, inputCls } from "./ui";

const NOTAS_MIN = [5, 7, 8, 9];

export function PainelFiltros({ aberto, onFechar, total }: { aberto: boolean; onFechar: () => void; total: number }) {
  const { filtros, setFiltros, tags } = useApp();

  const alternar = <T,>(lista: T[], v: T) => (lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);

  return (
    <Sheet
      aberto={aberto}
      onFechar={onFechar}
      titulo={<h2 className="font-display text-2xl font-extrabold">Filtros</h2>}
      rodape={
        <div className="flex gap-2">
          <Botao variant="secundario" className="flex-1" onClick={() => setFiltros(EMPTY_FILTERS)}>
            Limpar
          </Botao>
          <Botao className="flex-[2]" onClick={onFechar}>
            Ver {total} {total === 1 ? "lugar" : "lugares"}
          </Botao>
        </div>
      }
    >
      <div className="flex flex-col gap-6 pt-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" />
          <input
            className={`${inputCls} pl-12`}
            placeholder="Buscar por nome"
            aria-label="Buscar por nome"
            value={filtros.busca}
            onChange={(e) => setFiltros((f) => ({ ...f, busca: e.target.value }))}
            type="search"
          />
        </div>

        <section>
          <h3 className="mb-2 text-sm font-semibold">Mostrar só</h3>
          <div className="flex flex-wrap gap-2">
            <Chip ativo={filtros.naoFui} onClick={() => setFiltros((f) => ({ ...f, naoFui: !f.naoFui }))}>
              🧭 Ainda não fui
            </Chip>
            <Chip ativo={filtros.queroIr} onClick={() => setFiltros((f) => ({ ...f, queroIr: !f.queroIr }))}>
              ⭐ Quero ir
            </Chip>
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold">Nota mínima</h3>
          <div className="flex flex-wrap gap-2">
            {NOTAS_MIN.map((n) => (
              <Chip
                key={n}
                ativo={filtros.notaMin === n}
                onClick={() => setFiltros((f) => ({ ...f, notaMin: f.notaMin === n ? null : n }))}
              >
                {n}+
              </Chip>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold">Faixa de preço</h3>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4].map((n) => (
              <Chip
                key={n}
                ativo={filtros.precos.includes(n)}
                onClick={() => setFiltros((f) => ({ ...f, precos: alternar(f.precos, n) }))}
                aria-label={`Faixa de preço ${n} de 4`}
              >
                {"$".repeat(n)}
              </Chip>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold">Categorias</h3>
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <Chip key={t} ativo={filtros.tags.includes(t)} onClick={() => setFiltros((f) => ({ ...f, tags: alternar(f.tags, t) }))}>
                {t}
              </Chip>
            ))}
          </div>
        </section>
      </div>
    </Sheet>
  );
}
