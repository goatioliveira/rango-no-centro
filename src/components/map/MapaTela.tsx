"use client";

import dynamic from "next/dynamic";
import type L from "leaflet";
import { useCallback, useMemo, useRef, useState } from "react";
import { Crosshair, Dices, LocateFixed, MapPin, Plus, SlidersHorizontal } from "lucide-react";
import { aplicarFiltros, contarFiltros } from "@/lib/format";
import { minhaPosicao } from "@/lib/geo";
import { useApp } from "../AppProvider";
import { Botao, cx } from "../ui";
import { Marca } from "../Logo";
import { PainelFiltros } from "../Filtros";

// Leaflet mexe no "window", então só carrega no navegador.
const RangoMap = dynamic(() => import("./RangoMap"), {
  ssr: false,
  loading: () => <div className="skeleton absolute inset-0" />,
});

export function MapaTela() {
  const app = useApp();
  const { restaurantes, filtros, carregandoDados, escolhendoNoMapa, setEscolhendoNoMapa } = app;
  const mapa = useRef<L.Map | null>(null);
  const [localizando, setLocalizando] = useState(false);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  const visiveis = useMemo(() => aplicarFiltros(restaurantes, filtros), [restaurantes, filtros]);
  const nFiltros = contarFiltros(filtros) + (filtros.busca ? 1 : 0);
  const onMapa = useCallback((m: L.Map) => {
    mapa.current = m;
  }, []);

  async function localizar() {
    setLocalizando(true);
    try {
      const pos = await minhaPosicao();
      app.setMinhaPos(pos);
      app.focar(pos, 17);
    } catch (e) {
      app.avisar((e as Error).message, "erro");
    } finally {
      setLocalizando(false);
    }
  }

  function confirmarLocal() {
    const c = mapa.current?.getCenter();
    if (!c) return;
    setEscolhendoNoMapa(false);
    app.abrirAdicionar({ ...(app.adicionar ?? {}), pos: { lat: c.lat, lng: c.lng } });
  }

  const vazio = !carregandoDados && restaurantes.length === 0;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <RangoMap restaurantes={visiveis} onMapa={onMapa} />

      {/* Barra do topo */}
      <div className="pt-safe pointer-events-none absolute inset-x-0 top-0 z-[500]">
        <div className="flex items-center gap-2 px-3 pt-3">
          <div className="pointer-events-auto rounded-2xl bg-surface/95 px-3 py-2 shadow-soft backdrop-blur">
            <Marca />
          </div>
          <div className="flex-1" />
          {!escolhendoNoMapa ? (
            <>
              <button
                type="button"
                onClick={() => app.setSorteioAberto(true)}
                className="pointer-events-auto grid size-12 place-items-center rounded-2xl bg-surface/95 shadow-soft backdrop-blur active:scale-95"
                aria-label="Sorteia um almoço pra mim"
                title="Sorteia um almoço pra mim"
              >
                <Dices className="size-6" />
              </button>
              <button
                type="button"
                onClick={() => setFiltrosAbertos(true)}
                className={cx(
                  "pointer-events-auto relative grid size-12 place-items-center rounded-2xl shadow-soft backdrop-blur active:scale-95",
                  nFiltros ? "bg-ink text-bg" : "bg-surface/95",
                )}
                aria-label={nFiltros ? `Filtros (${nFiltros} ativos)` : "Filtros"}
              >
                <SlidersHorizontal className="size-6" />
                {nFiltros ? (
                  <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-brand text-[11px] font-bold text-brand-ink">
                    {nFiltros}
                  </span>
                ) : null}
              </button>
            </>
          ) : null}
        </div>
        {nFiltros && !escolhendoNoMapa ? (
          <p className="mx-3 mt-2 inline-block rounded-full bg-ink/85 px-3 py-1 text-xs font-medium text-bg">
            Mostrando {visiveis.length} de {restaurantes.length} lugares
          </p>
        ) : null}
      </div>

      {/* Mapa vazio */}
      {vazio && !escolhendoNoMapa ? (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-[500] flex -translate-y-1/2 justify-center px-6">
          <div className="anim-aparece pointer-events-auto max-w-sm rounded-3xl bg-surface/95 p-6 text-center shadow-soft backdrop-blur">
            <div className="anim-pulo text-5xl" aria-hidden>
              🍛
            </div>
            <h2 className="mt-2 font-display text-2xl leading-tight font-extrabold">Nenhum rango marcado ainda.</h2>
            <p className="mt-1 text-muted">Bora inaugurar o mapa? Toque no + ou segure o dedo no lugar onde você almoçou.</p>
            <Botao className="mt-4 w-full" onClick={() => app.abrirAdicionar()}>
              <Plus className="size-5" /> Marcar o primeiro
            </Botao>
          </div>
        </div>
      ) : null}

      {/* Modo "escolher no mapa": mira fixa no centro */}
      {escolhendoNoMapa ? (
        <>
          <div className="pointer-events-none absolute inset-0 z-[500] grid place-items-center">
            <div className="flex -translate-y-5 flex-col items-center">
              <MapPin className="size-12 fill-brand text-ink drop-shadow-lg" strokeWidth={1.5} />
              <span className="-mt-1 size-2 rounded-full bg-ink/60" />
            </div>
          </div>
          <div className="pt-safe absolute inset-x-0 top-0 z-[600] p-3">
            <p className="rounded-2xl bg-ink px-4 py-3 text-center text-sm font-medium text-bg shadow-soft">
              Arraste o mapa até o pino ficar em cima do restaurante
            </p>
          </div>
          <div className="absolute inset-x-0 bottom-0 z-[600] flex gap-2 p-3 pb-[max(20px,env(safe-area-inset-bottom))]">
            <Botao variant="secundario" className="flex-1" onClick={() => setEscolhendoNoMapa(false)}>
              Cancelar
            </Botao>
            <Botao className="flex-[2]" onClick={confirmarLocal}>
              <Crosshair className="size-5" /> É aqui!
            </Botao>
          </div>
        </>
      ) : (
        <div className="absolute right-3 bottom-4 z-[500] flex flex-col items-end gap-3">
          <button
            type="button"
            onClick={localizar}
            className="grid size-12 place-items-center rounded-2xl bg-surface/95 shadow-soft backdrop-blur active:scale-95"
            aria-label="Minha localização"
          >
            <LocateFixed className={cx("size-6", localizando && "animate-pulse text-sea")} />
          </button>
          <button
            type="button"
            onClick={() => app.abrirAdicionar()}
            className="grid size-16 place-items-center rounded-[22px] bg-brand text-brand-ink shadow-soft transition active:scale-95"
            aria-label="Adicionar restaurante"
          >
            <Plus className="size-8" strokeWidth={2.5} />
          </button>
        </div>
      )}

      <PainelFiltros aberto={filtrosAbertos} onFechar={() => setFiltrosAbertos(false)} total={visiveis.length} />
    </div>
  );
}
