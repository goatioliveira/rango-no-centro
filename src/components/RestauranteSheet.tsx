"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Map as MapIcon, MapPin, Navigation, Pencil, Star, Trash2 } from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";
import {
  VOLTARIA_LABEL,
  faixaPrecoLabel,
  formatData,
  formatNota,
  formatPreco,
  linkGoogleMaps,
  linkWaze,
} from "@/lib/format";
import type { Review } from "@/lib/types";
import { mensagemErro, useApp } from "./AppProvider";
import { Avatar, Botao, NotaBadge, Sheet, cx } from "./ui";
import { EditarRestaurante } from "./AdicionarRestaurante";
import { apagarFotos } from "@/lib/fotos";

export function RestauranteSheet() {
  const app = useApp();
  const { selecionadoId, restaurantes, membros, versao, userId, profile } = app;
  const r = restaurantes.find((x) => x.id === selecionadoId) ?? null;
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [fotos, setFotos] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [salvandoQuero, setSalvandoQuero] = useState(false);
  const [fotoAberta, setFotoAberta] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  const carregar = useCallback(async (id: string) => {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("reviews")
      .select("*, review_photos(id, path)")
      .eq("restaurant_id", id)
      .order("data_visita", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) {
      setErro(mensagemErro(error));
      return;
    }
    setErro(null);
    const lista = (data ?? []) as Review[];
    setReviews(lista);
    const paths = lista.flatMap((rv) => rv.review_photos?.map((p) => p.path) ?? []);
    if (paths.length) {
      const { data: urls } = await supabase.storage.from("fotos").createSignedUrls(paths, 60 * 60);
      setFotos(Object.fromEntries((urls ?? []).filter((u) => u.signedUrl).map((u) => [u.path, u.signedUrl])));
    } else {
      setFotos({});
    }
  }, []);

  useEffect(() => {
    if (!selecionadoId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca as avaliações do restaurante aberto
    void carregar(selecionadoId);
  }, [selecionadoId, versao, carregar]);

  useEffect(() => {
    // Ao trocar de restaurante, limpa o que era do anterior.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReviews(null);
    setEditando(false);
  }, [selecionadoId]);

  if (!selecionadoId) return null;
  if (!r) {
    return (
      <Sheet aberto onFechar={app.fecharRestaurante}>
        <p className="py-8 text-center text-muted">Esse lugar não existe mais.</p>
      </Sheet>
    );
  }

  const autor = (id: string) => membros.find((m) => m.id === id);
  const minhasReviews = reviews?.filter((rv) => rv.user_id === userId) ?? [];
  const podeApagarRestaurante = profile?.is_admin || r.criado_por === userId;

  async function alternarQueroIr() {
    if (!r) return;
    setSalvandoQuero(true);
    const supabase = getSupabase();
    const { error } = r.eu_quero
      ? await supabase.from("wishlist").delete().eq("restaurant_id", r.id).eq("user_id", userId!)
      : await supabase.from("wishlist").insert({ restaurant_id: r.id, user_id: userId });
    setSalvandoQuero(false);
    if (error) return app.avisar(mensagemErro(error), "erro");
    app.avisar(r.eu_quero ? "Tirado da sua lista" : "Anotado na sua lista de quero ir ⭐");
    await app.recarregar();
  }

  async function apagarReview(rv: Review) {
    if (!confirm("Apagar essa avaliação? Não dá pra desfazer.")) return;
    const supabase = getSupabase();
    await apagarFotos(rv.review_photos?.map((p) => p.path) ?? []);
    const { error } = await supabase.from("reviews").delete().eq("id", rv.id);
    if (error) return app.avisar(mensagemErro(error), "erro");
    app.avisar("Avaliação apagada");
    await Promise.all([app.recarregar(), carregar(rv.restaurant_id)]);
  }

  async function apagarRestaurante() {
    if (!r) return;
    if (!confirm(`Apagar "${r.nome}" e todas as avaliações dele? Não dá pra desfazer.`)) return;
    const supabase = getSupabase();
    await apagarFotos(reviews?.flatMap((rv) => rv.review_photos?.map((p) => p.path) ?? []) ?? []);
    const { error } = await supabase.from("restaurants").delete().eq("id", r.id);
    if (error) return app.avisar(mensagemErro(error), "erro");
    app.avisar("Restaurante apagado");
    app.fecharRestaurante();
    await app.recarregar();
  }

  if (editando) {
    return <EditarRestaurante restaurante={r} onFechar={() => setEditando(false)} />;
  }

  return (
    <Sheet
      aberto
      onFechar={app.fecharRestaurante}
      semFundo
      titulo={
        <div className="flex items-start gap-3">
          <NotaBadge nota={r.media} tamanho="lg" />
          <div className="min-w-0">
            <h2 className="font-display text-2xl leading-tight font-extrabold">{r.nome}</h2>
            <p className="text-sm text-muted">
              {r.num_avaliadores === 0
                ? "Ninguém avaliou ainda"
                : `${r.num_avaliadores} ${r.num_avaliadores === 1 ? "pessoa" : "pessoas"} · ${r.num_avaliacoes} ${
                    r.num_avaliacoes === 1 ? "visita" : "visitas"
                  }`}
              {r.preco_medio != null ? ` · ~${formatPreco(r.preco_medio)}` : ""}
              {r.faixa_preco ? ` · ${faixaPrecoLabel(r.faixa_preco)}` : ""}
            </p>
          </div>
        </div>
      }
      rodape={
        <div className="flex gap-2">
          <Botao
            variant="secundario"
            onClick={alternarQueroIr}
            carregando={salvandoQuero}
            aria-pressed={r.eu_quero}
            className={cx("px-4", r.eu_quero && "border-sun bg-sun/20")}
          >
            {!salvandoQuero ? <Star className={cx("size-5", r.eu_quero && "fill-sun text-sun")} /> : null}
            {r.eu_quero ? "Na lista" : "Quero ir"}
          </Botao>
          <Botao className="flex-1" onClick={() => app.abrirAvaliacao(r.id)}>
            {minhasReviews.length ? "Avaliar de novo" : "Avaliar"}
          </Botao>
        </div>
      }
    >
      <div className="flex flex-col gap-4 pt-2">
        {r.endereco ? (
          <p className="flex items-start gap-1.5 text-sm text-muted">
            <MapPin className="mt-0.5 size-4 shrink-0" /> {r.endereco}
          </p>
        ) : null}

        {r.tags.length ? (
          <div className="flex flex-wrap gap-1.5">
            {r.tags.map((t) => (
              <span key={t} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium">
                {t}
              </span>
            ))}
          </div>
        ) : null}

        <div className="flex gap-2">
          {pathname !== "/" ? (
            <button
              type="button"
              onClick={() => {
                router.push("/");
                app.abrirRestaurante(r.id, true);
              }}
              className="grid min-h-11 w-11 place-items-center rounded-2xl border border-line"
              aria-label="Ver no mapa"
            >
              <MapIcon className="size-4" />
            </button>
          ) : null}
          <a
            href={linkGoogleMaps(r)}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-2xl border border-line text-sm font-semibold"
          >
            <Navigation className="size-4" /> Google Maps
          </a>
          <a
            href={linkWaze(r)}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-2xl border border-line text-sm font-semibold"
          >
            <Navigation className="size-4" /> Waze
          </a>
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="grid min-h-11 w-11 place-items-center rounded-2xl border border-line"
            aria-label="Editar dados do restaurante"
          >
            <Pencil className="size-4" />
          </button>
        </div>

        {r.num_quero_ir > 0 ? (
          <p className="text-sm text-muted">
            ⭐ {r.num_quero_ir} {r.num_quero_ir === 1 ? "pessoa quer" : "pessoas querem"} conhecer
          </p>
        ) : null}

        <h3 className="mt-2 font-display text-lg font-bold">Avaliações da galera</h3>

        {erro ? (
          <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">
            {erro}
          </p>
        ) : reviews == null ? (
          <div className="flex flex-col gap-3">
            <div className="skeleton h-24 rounded-2xl" />
            <div className="skeleton h-24 rounded-2xl" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line px-4 py-6 text-center">
            <p className="text-2xl">🍽️</p>
            <p className="mt-1 font-semibold">Ainda sem avaliação</p>
            <p className="text-sm text-muted">Foi lá? Conta pra galera como foi.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {reviews.map((rv) => {
              const a = autor(rv.user_id);
              const minha = rv.user_id === userId;
              return (
                <li key={rv.id} className="rounded-2xl border border-line bg-bg p-4">
                  <div className="flex items-center gap-3">
                    <Avatar url={a?.avatar_url} nome={a?.apelido ?? "?"} tamanho={40} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {a?.apelido ?? "Ex-membro"}
                        {minha ? <span className="font-normal text-muted"> (você)</span> : null}
                      </p>
                      <p className="text-xs text-muted">
                        {formatData(rv.data_visita)}
                        {rv.preco_pago != null ? ` · ${formatPreco(rv.preco_pago)}` : ""}
                      </p>
                    </div>
                    <NotaBadge nota={rv.nota_geral} />
                  </div>

                  {rv.nota_comida != null || rv.nota_atendimento != null || rv.nota_custo_beneficio != null || rv.voltaria ? (
                    <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                      {rv.nota_comida != null ? <Pilula>Comida {formatNota(rv.nota_comida)}</Pilula> : null}
                      {rv.nota_atendimento != null ? <Pilula>Atendimento {formatNota(rv.nota_atendimento)}</Pilula> : null}
                      {rv.nota_custo_beneficio != null ? (
                        <Pilula>Custo-benefício {formatNota(rv.nota_custo_beneficio)}</Pilula>
                      ) : null}
                      {rv.voltaria ? (
                        <Pilula>
                          {rv.voltaria === "sim" ? "👍" : rv.voltaria === "nao" ? "👎" : "🤷"} {VOLTARIA_LABEL[rv.voltaria]}
                        </Pilula>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-2 flex flex-col gap-1 text-[15px]">
                    {rv.o_que_pediu ? (
                      <p>
                        <span className="text-muted">Pediu:</span> {rv.o_que_pediu}
                      </p>
                    ) : null}
                    {rv.pontos_positivos ? <p>✅ {rv.pontos_positivos}</p> : null}
                    {rv.pontos_negativos ? <p>⚠️ {rv.pontos_negativos}</p> : null}
                    {rv.comentario ? <p className="whitespace-pre-line">{rv.comentario}</p> : null}
                  </div>

                  {rv.review_photos?.length ? (
                    <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
                      {rv.review_photos.map((p) =>
                        fotos[p.path] ? (
                          <button key={p.id} type="button" onClick={() => setFotoAberta(fotos[p.path])} className="shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={fotos[p.path]} alt="Foto da avaliação" className="size-24 rounded-xl object-cover" />
                          </button>
                        ) : (
                          <div key={p.id} className="skeleton size-24 shrink-0 rounded-xl" />
                        ),
                      )}
                    </div>
                  ) : null}

                  {minha || profile?.is_admin ? (
                    <div className="mt-3 flex gap-2">
                      {minha ? (
                        <button
                          type="button"
                          onClick={() => app.abrirAvaliacao(r.id, rv)}
                          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold hover:bg-surface-2"
                        >
                          <Pencil className="size-4" /> Editar
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => apagarReview(rv)}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-danger hover:bg-danger/10"
                      >
                        <Trash2 className="size-4" /> Apagar
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        {podeApagarRestaurante ? (
          <button
            type="button"
            onClick={apagarRestaurante}
            className="mx-auto mt-4 inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm text-danger hover:bg-danger/10"
          >
            <Trash2 className="size-4" /> Apagar este restaurante
          </button>
        ) : null}
      </div>

      {fotoAberta ? (
        <button
          type="button"
          className="anim-aparece fixed inset-0 z-[1100] grid place-items-center bg-black/90 p-4"
          onClick={() => setFotoAberta(null)}
          aria-label="Fechar foto"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={fotoAberta} alt="Foto da avaliação" className="max-h-full max-w-full rounded-2xl object-contain" />
        </button>
      ) : null}
    </Sheet>
  );
}

function Pilula({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-surface-2 px-2.5 py-1 font-medium">{children}</span>;
}
