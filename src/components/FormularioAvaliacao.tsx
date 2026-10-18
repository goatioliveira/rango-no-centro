"use client";

import { useEffect, useMemo, useState } from "react";
import { Camera, ChevronDown, Minus, Plus, Trash2, X } from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";
import { COR_FAIXA, faixaDaNota, formatNota, hojeISO } from "@/lib/format";
import { MAX_FOTOS, apagarFotos, enviarFotos } from "@/lib/fotos";
import type { Voltaria } from "@/lib/types";
import { mensagemErro, useApp } from "./AppProvider";
import { Botao, Campo, Chip, Sheet, cx, inputCls } from "./ui";

const FRASES: [number, string][] = [
  [9.5, "Absurdo de bom 🤩"],
  [8.5, "Muito bom!"],
  [7, "Bom, voltaria"],
  [5, "Ok, quebra o galho"],
  [3, "Fraquinho"],
  [0, "Passa longe 🙅"],
];

function frase(n: number) {
  return FRASES.find(([min]) => n >= min)?.[1] ?? "";
}

function NotaGrande({ valor, onChange }: { valor: number; onChange: (n: number) => void }) {
  const cor = COR_FAIXA[faixaDaNota(valor)];
  const ajustar = (d: number) => onChange(Math.min(10, Math.max(0, valor + d)));
  return (
    <div className="flex flex-col items-center gap-2 rounded-3xl bg-surface-2 px-4 pt-4 pb-3">
      <div className="flex w-full items-center justify-between">
        <button
          type="button"
          onClick={() => ajustar(-0.5)}
          className="grid size-14 place-items-center rounded-2xl bg-surface active:scale-95"
          aria-label="Diminuir meio ponto"
        >
          <Minus className="size-6" />
        </button>
        <div className="flex flex-col items-center">
          <output
            className="font-display text-7xl leading-none font-extrabold tabular-nums transition-colors"
            style={{ color: cor.bg }}
            aria-live="polite"
          >
            {formatNota(valor)}
          </output>
          <span className="mt-1 text-sm font-medium text-muted">{frase(valor)}</span>
        </div>
        <button
          type="button"
          onClick={() => ajustar(0.5)}
          className="grid size-14 place-items-center rounded-2xl bg-surface active:scale-95"
          aria-label="Aumentar meio ponto"
        >
          <Plus className="size-6" />
        </button>
      </div>
      <input
        type="range"
        min={0}
        max={10}
        step={0.5}
        value={valor}
        onChange={(e) => onChange(Number(e.target.value))}
        className="nota-slider"
        aria-label="Nota geral, de 0 a 10"
      />
      <div className="flex w-full justify-between px-1 text-xs text-muted" aria-hidden>
        <span>0</span>
        <span>5</span>
        <span>10</span>
      </div>
    </div>
  );
}

function NotaOpcional({ label, valor, onChange }: { label: string; valor: number | null; onChange: (n: number | null) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{label}</span>
        <span className="flex items-center gap-2">
          <span className="font-display text-xl font-extrabold tabular-nums">{valor == null ? "–" : formatNota(valor)}</span>
          {valor != null ? (
            <button type="button" onClick={() => onChange(null)} className="text-xs text-muted underline" aria-label={`Limpar ${label}`}>
              limpar
            </button>
          ) : null}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={10}
        step={0.5}
        value={valor ?? 5}
        onChange={(e) => onChange(Number(e.target.value))}
        onClick={(e) => valor == null && onChange(Number((e.target as HTMLInputElement).value))}
        className={cx("nota-slider", valor == null && "vazio")}
        aria-label={`${label}, de 0 a 10`}
      />
    </div>
  );
}

export function FormularioAvaliacao() {
  const app = useApp();
  const { avaliacao, restaurantes, userId } = app;
  const edit = avaliacao?.review;
  const restaurante = restaurantes.find((r) => r.id === avaliacao?.restaurantId);

  const [nota, setNota] = useState<number>(edit?.nota_geral ?? 7);
  const [voltaria, setVoltaria] = useState<Voltaria | null>(edit?.voltaria ?? null);
  const [comentario, setComentario] = useState(edit?.comentario ?? "");
  const [detalhes, setDetalhes] = useState(false);
  const [comida, setComida] = useState<number | null>(edit?.nota_comida ?? null);
  const [atendimento, setAtendimento] = useState<number | null>(edit?.nota_atendimento ?? null);
  const [custo, setCusto] = useState<number | null>(edit?.nota_custo_beneficio ?? null);
  const [preco, setPreco] = useState(edit?.preco_pago != null ? String(edit.preco_pago).replace(".", ",") : "");
  const [pediu, setPediu] = useState(edit?.o_que_pediu ?? "");
  const [positivos, setPositivos] = useState(edit?.pontos_positivos ?? "");
  const [negativos, setNegativos] = useState(edit?.pontos_negativos ?? "");
  const [data, setData] = useState(edit?.data_visita ?? hojeISO());
  const [novasFotos, setNovasFotos] = useState<File[]>([]);
  const [fotosRemovidas, setFotosRemovidas] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  const fotosExistentes = (edit?.review_photos ?? []).filter((p) => !fotosRemovidas.includes(p.path));
  const vagas = MAX_FOTOS - fotosExistentes.length - novasFotos.length;
  const previews = useMemo(() => novasFotos.map((f) => URL.createObjectURL(f)), [novasFotos]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  if (!avaliacao) return null;

  const precoNum = preco.trim() ? Number(preco.replace(/\./g, "").replace(",", ".")) : null;
  const precoInvalido = precoNum != null && (Number.isNaN(precoNum) || precoNum < 0 || precoNum >= 100000);

  async function salvar() {
    if (!avaliacao || !userId || precoInvalido) return;
    setSalvando(true);
    const supabase = getSupabase();
    const campos = {
      nota_geral: nota,
      nota_comida: comida,
      nota_atendimento: atendimento,
      nota_custo_beneficio: custo,
      preco_pago: precoNum,
      o_que_pediu: pediu.trim() || null,
      pontos_positivos: positivos.trim() || null,
      pontos_negativos: negativos.trim() || null,
      comentario: comentario.trim() || null,
      data_visita: data || hojeISO(),
      voltaria,
    };
    try {
      let reviewId = edit?.id;
      if (edit) {
        const { error } = await supabase.from("reviews").update(campos).eq("id", edit.id);
        if (error) throw error;
      } else {
        const { data: nova, error } = await supabase
          .from("reviews")
          .insert({ ...campos, restaurant_id: avaliacao.restaurantId, user_id: userId })
          .select("id")
          .single();
        if (error) throw error;
        reviewId = nova.id;
      }
      if (fotosRemovidas.length) {
        await apagarFotos(fotosRemovidas);
        await supabase.from("review_photos").delete().in("path", fotosRemovidas);
      }
      if (novasFotos.length && reviewId) {
        try {
          await enviarFotos(userId, reviewId, novasFotos);
        } catch (e) {
          app.avisar(`Avaliação salva, mas as fotos falharam: ${mensagemErro(e)}`, "erro");
        }
      }
      app.avisar(edit ? "Avaliação atualizada" : "Rango avaliado! Valeu 🙌");
      app.fecharAvaliacao();
      app.abrirRestaurante(avaliacao.restaurantId);
      await app.recarregar();
    } catch (e) {
      app.avisar(mensagemErro(e), "erro");
    } finally {
      setSalvando(false);
    }
  }

  async function apagar() {
    if (!edit || !confirm("Apagar essa avaliação? Não dá pra desfazer.")) return;
    setSalvando(true);
    await apagarFotos(edit.review_photos?.map((p) => p.path) ?? []);
    const { error } = await getSupabase().from("reviews").delete().eq("id", edit.id);
    setSalvando(false);
    if (error) return app.avisar(mensagemErro(error), "erro");
    app.avisar("Avaliação apagada");
    app.fecharAvaliacao();
    await app.recarregar();
  }

  return (
    <Sheet
      aberto
      onFechar={app.fecharAvaliacao}
      altura="cheia"
      titulo={
        <div>
          <p className="text-sm font-medium text-muted">{edit ? "Editar avaliação" : "Como foi o rango?"}</p>
          <h2 className="truncate font-display text-2xl font-extrabold">{restaurante?.nome ?? "Restaurante"}</h2>
        </div>
      }
      rodape={
        <div className="flex gap-2">
          {edit ? (
            <Botao variant="perigo" onClick={apagar} disabled={salvando} aria-label="Apagar avaliação" className="px-4">
              <Trash2 className="size-5" />
            </Botao>
          ) : null}
          <Botao className="flex-1" onClick={salvar} carregando={salvando} disabled={precoInvalido}>
            {edit ? "Salvar alterações" : "Publicar avaliação"}
          </Botao>
        </div>
      }
    >
      <div className="flex flex-col gap-5 pt-2">
        <NotaGrande valor={nota} onChange={setNota} />

        <div>
          <p className="mb-2 text-sm font-semibold">Voltaria?</p>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Voltaria?">
            {(
              [
                ["sim", "👍 Sim"],
                ["talvez", "🤷 Talvez"],
                ["nao", "👎 Não"],
              ] as const
            ).map(([v, label]) => (
              <Chip
                key={v}
                role="radio"
                aria-checked={voltaria === v}
                ativo={voltaria === v}
                onClick={() => setVoltaria(voltaria === v ? null : v)}
                className="min-h-12 justify-center text-[15px]"
              >
                {label}
              </Chip>
            ))}
          </div>
        </div>

        <Campo label="Comentário" htmlFor="av-coment">
          <textarea
            id="av-coment"
            className={`${inputCls} min-h-24 py-3`}
            value={comentario}
            maxLength={2000}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="Conta rapidinho como foi"
          />
        </Campo>

        <button
          type="button"
          onClick={() => setDetalhes(!detalhes)}
          aria-expanded={detalhes}
          className="flex min-h-12 items-center justify-between rounded-2xl border border-line px-4 font-semibold"
        >
          Mais detalhes
          <ChevronDown className={cx("size-5 transition", detalhes && "rotate-180")} />
        </button>

        {detalhes ? (
          <div className="flex flex-col gap-5">
            <NotaOpcional label="Comida" valor={comida} onChange={setComida} />
            <NotaOpcional label="Atendimento" valor={atendimento} onChange={setAtendimento} />
            <NotaOpcional label="Custo-benefício" valor={custo} onChange={setCusto} />

            <div className="grid grid-cols-2 gap-3">
              <Campo label="Quanto pagou (por pessoa)" htmlFor="av-preco">
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted">R$</span>
                  <input
                    id="av-preco"
                    className={cx(inputCls, "pl-11", precoInvalido && "border-danger")}
                    inputMode="decimal"
                    value={preco}
                    onChange={(e) => setPreco(e.target.value.replace(/[^\d.,]/g, ""))}
                    placeholder="35,00"
                  />
                </div>
              </Campo>
              <Campo label="Dia da visita" htmlFor="av-data">
                <input
                  id="av-data"
                  type="date"
                  className={inputCls}
                  value={data}
                  max={hojeISO()}
                  onChange={(e) => setData(e.target.value)}
                />
              </Campo>
            </div>

            <Campo label="O que pediu" htmlFor="av-pediu">
              <input
                id="av-pediu"
                className={inputCls}
                value={pediu}
                maxLength={500}
                onChange={(e) => setPediu(e.target.value)}
                placeholder="Ex.: filé à Oswaldo Aranha"
              />
            </Campo>
            <Campo label="Pontos positivos" htmlFor="av-pos">
              <textarea
                id="av-pos"
                className={`${inputCls} min-h-20 py-3`}
                value={positivos}
                maxLength={1000}
                onChange={(e) => setPositivos(e.target.value)}
              />
            </Campo>
            <Campo label="Pontos negativos" htmlFor="av-neg">
              <textarea
                id="av-neg"
                className={`${inputCls} min-h-20 py-3`}
                value={negativos}
                maxLength={1000}
                onChange={(e) => setNegativos(e.target.value)}
              />
            </Campo>

            <div>
              <p className="mb-2 text-sm font-semibold">Fotos (até {MAX_FOTOS})</p>
              <div className="flex flex-wrap gap-2">
                {fotosExistentes.map((p) => (
                  <MiniFoto key={p.path} rotulo="foto salva" onRemover={() => setFotosRemovidas((r) => [...r, p.path])} />
                ))}
                {previews.map((url, i) => (
                  <MiniFoto key={url} url={url} rotulo={`foto nova ${i + 1}`} onRemover={() => setNovasFotos((f) => f.filter((_, j) => j !== i))} />
                ))}
                {vagas > 0 ? (
                  <label className="grid size-24 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-line text-muted">
                    <span className="flex flex-col items-center gap-1 text-xs">
                      <Camera className="size-6" /> Adicionar
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="sr-only"
                      onChange={(e) => {
                        const arquivos = Array.from(e.target.files ?? []).slice(0, vagas);
                        setNovasFotos((f) => [...f, ...arquivos]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}

function MiniFoto({ url, rotulo, onRemover }: { url?: string; rotulo: string; onRemover: () => void }) {
  return (
    <div className="relative size-24">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={rotulo} className="size-24 rounded-xl object-cover" />
      ) : (
        <div className="grid size-24 place-items-center rounded-xl bg-surface-2 text-2xl" aria-label={rotulo}>
          🖼️
        </div>
      )}
      <button
        type="button"
        onClick={onRemover}
        className="absolute -top-2 -right-2 grid size-8 place-items-center rounded-full bg-ink text-bg"
        aria-label={`Remover ${rotulo}`}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
