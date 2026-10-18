"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ClipboardPaste, Crosshair, ExternalLink, LocateFixed, MapPin, Plus, Search, Signpost } from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";
import { buscarNominatim, buscarPhoton, enderecoDoPonto, minhaPosicao, type Lugar } from "@/lib/geo";
import { distanciaM, formatDistancia, possiveisDuplicatas } from "@/lib/format";
import { expandirAbreviacoes, extrairLinkMaps } from "@/lib/linkMaps";
import type { LatLng, Restaurant } from "@/lib/types";
import { mensagemErro, useApp } from "./AppProvider";
import { Botao, Campo, Chip, NotaBadge, Sheet, Spinner, inputCls } from "./ui";

/** Campos do restaurante (usados ao criar e ao editar). */
function CamposRestaurante({
  nome,
  setNome,
  endereco,
  setEndereco,
  tagsSel,
  setTagsSel,
  faixa,
  setFaixa,
  focarNome,
}: {
  focarNome?: boolean;
  nome: string;
  setNome: (v: string) => void;
  endereco: string;
  setEndereco: (v: string) => void;
  tagsSel: string[];
  setTagsSel: (v: string[]) => void;
  faixa: number | null;
  setFaixa: (v: number | null) => void;
}) {
  const { tags, userId, avisar, recarregar } = useApp();
  const [novaTag, setNovaTag] = useState("");
  const todas = useMemo(() => Array.from(new Set([...tags, ...tagsSel])), [tags, tagsSel]);

  async function criarTag() {
    const t = novaTag.trim().slice(0, 30);
    if (!t) return;
    setNovaTag("");
    if (!tags.some((x) => x.toLowerCase() === t.toLowerCase())) {
      const { error } = await getSupabase().from("tags").insert({ nome: t, criado_por: userId });
      if (error && !/duplicate/.test(error.message)) avisar(mensagemErro(error), "erro");
      void recarregar();
    }
    if (!tagsSel.includes(t)) setTagsSel([...tagsSel, t]);
  }

  return (
    <div className="flex flex-col gap-5">
      <Campo label="Nome do restaurante" htmlFor="r-nome">
        <input
          id="r-nome"
          className={inputCls}
          value={nome}
          maxLength={120}
          onChange={(e) => setNome(e.target.value)}
          autoFocus={focarNome}
          placeholder="Ex.: Bar Luiz"
        />
      </Campo>
      <Campo label="Endereço" htmlFor="r-end" dica="Opcional, mas ajuda a galera a achar.">
        <input
          id="r-end"
          className={inputCls}
          value={endereco}
          maxLength={300}
          onChange={(e) => setEndereco(e.target.value)}
          placeholder="Rua, número"
        />
      </Campo>
      <div>
        <p className="mb-2 text-sm font-semibold">Faixa de preço</p>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((n) => (
            <Chip key={n} ativo={faixa === n} onClick={() => setFaixa(faixa === n ? null : n)} className="flex-1 justify-center">
              {"$".repeat(n)}
            </Chip>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted">$ até R$ 30 · $$ até R$ 60 · $$$ até R$ 100 · $$$$ acima disso</p>
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold">Categorias</p>
        <div className="flex flex-wrap gap-2">
          {todas.map((t) => (
            <Chip
              key={t}
              ativo={tagsSel.includes(t)}
              onClick={() => setTagsSel(tagsSel.includes(t) ? tagsSel.filter((x) => x !== t) : [...tagsSel, t])}
            >
              {t}
            </Chip>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            className={inputCls}
            placeholder="Nova categoria"
            aria-label="Nova categoria"
            value={novaTag}
            maxLength={30}
            onChange={(e) => setNovaTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void criarTag();
              }
            }}
          />
          <Botao type="button" variant="secundario" onClick={criarTag} disabled={!novaTag.trim()} aria-label="Criar categoria">
            <Plus className="size-5" />
          </Botao>
        </div>
      </div>
    </div>
  );
}

function AvisoDuplicata({ duplicatas, pos }: { duplicatas: Restaurant[]; pos: LatLng | null }) {
  const app = useApp();
  if (!duplicatas.length) return null;
  return (
    <div className="rounded-2xl border-2 border-sun bg-sun/15 p-4">
      <p className="font-semibold">Opa, já tem esse aqui? 👀</p>
      <ul className="mt-2 flex flex-col gap-2">
        {duplicatas.map((d) => (
          <li key={d.id} className="flex items-center gap-3 rounded-xl bg-surface p-2.5">
            <NotaBadge nota={d.media} tamanho="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{d.nome}</p>
              {pos ? <p className="text-xs text-muted">a {formatDistancia(distanciaM(pos, d))} daqui</p> : null}
            </div>
            <Botao
              type="button"
              variant="secundario"
              className="min-h-10 px-3 text-sm"
              onClick={() => {
                app.fecharAdicionar();
                app.abrirRestaurante(d.id, true);
                app.abrirAvaliacao(d.id);
              }}
            >
              Avaliar ele
            </Botao>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">Se for outro lugar mesmo, pode continuar.</p>
    </div>
  );
}

export function AdicionarRestaurante() {
  const app = useApp();
  const inicial = app.adicionar;
  const [pos, setPos] = useState<LatLng | null>(inicial?.pos ?? null);
  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [endereco, setEndereco] = useState(inicial?.endereco ?? "");
  const [tagsSel, setTagsSel] = useState<string[]>([]);
  const [faixa, setFaixa] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Busca
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<Lugar[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [erroBusca, setErroBusca] = useState<string | null>(null);
  const [localizando, setLocalizando] = useState(false);
  const [lendoLink, setLendoLink] = useState(false);
  const [aproximado, setAproximado] = useState(false);
  const controle = useRef<AbortController | null>(null);

  // Quando volta do "escolher no mapa", recebe a posição nova.
  useEffect(() => {
    if (inicial?.pos) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza com a escolha feita no mapa
      setPos(inicial.pos);
      if (!inicial.endereco) {
        void enderecoDoPonto(inicial.pos).then((end) => end && setEndereco((atual) => atual || end));
      }
    }
  }, [inicial?.pos, inicial?.endereco]);

  // Autocompletar (Photon), com espera de 400 ms depois da última tecla.
  useEffect(() => {
    const termo = q.trim();
    controle.current?.abort();
    if (termo.length < 3 || extrairLinkMaps(termo)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResultados(null);
      return;
    }
    const ac = new AbortController();
    controle.current = ac;
    const t = setTimeout(async () => {
      setBuscando(true);
      setErroBusca(null);
      try {
        setResultados(await buscarPhoton(termo, ac.signal));
      } catch (e) {
        if ((e as Error).name !== "AbortError") setErroBusca("A busca automática falhou. Tente o botão Buscar.");
      } finally {
        if (!ac.signal.aborted) setBuscando(false);
      }
    }, 400);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [q]);

  async function buscarExplicito(e?: React.FormEvent) {
    e?.preventDefault();
    const termo = q.trim();
    if (termo.length < 2) return;
    controle.current?.abort();
    setBuscando(true);
    setErroBusca(null);
    try {
      const nom = await buscarNominatim(termo);
      if (nom.length) setResultados(nom);
      else setResultados((r) => r ?? []);
    } catch {
      setErroBusca("Não deu pra buscar agora. Use o mapa pra marcar o lugar.");
    } finally {
      setBuscando(false);
    }
  }

  // Link do Google Maps colado na busca: lê no servidor e já vai pros detalhes.
  async function lerLink(texto: string) {
    const link = extrairLinkMaps(texto);
    if (!link) return false;
    setLendoLink(true);
    setErroBusca(null);
    try {
      const res = await fetch(`/api/link-maps?url=${encodeURIComponent(link.url)}`);
      const dados = (await res.json()) as {
        erro?: string;
        nome: string | null;
        endereco: string | null;
        lat: number | null;
        lng: number | null;
        aproximado: boolean;
      };
      if (!res.ok || dados.erro) {
        setErroBusca(dados.erro ?? "Não consegui ler esse link.");
        return true;
      }
      const nomeLink = dados.nome ?? (link.textoAntes.split("\n")[0] || "");
      if (dados.lat == null || dados.lng == null) {
        setQ(nomeLink);
        setErroBusca("O link não diz onde fica o lugar. Procure pelo nome abaixo ou marque no mapa.");
        return true;
      }
      const p = { lat: dados.lat, lng: dados.lng };
      setNome(nomeLink);
      setEndereco(dados.endereco ?? "");
      setAproximado(dados.aproximado);
      setPos(p);
      app.focar(p, 18);
      if (!dados.endereco) void enderecoDoPonto(p).then((end) => end && setEndereco((atual) => atual || end));
      setQ("");
    } catch {
      setErroBusca("Não consegui ler esse link agora. Confere a internet e tenta de novo.");
    } finally {
      setLendoLink(false);
    }
    return true;
  }

  async function colarLink() {
    try {
      const texto = await navigator.clipboard.readText();
      if (!extrairLinkMaps(texto)) {
        setErroBusca("O que está copiado não é um link do Google Maps. No Google Maps, toque em Compartilhar → Copiar link.");
        return;
      }
      setQ(texto);
      await lerLink(texto);
    } catch {
      setErroBusca("O navegador não deixou colar automaticamente. Toque e segure no campo de busca e escolha Colar.");
    }
  }

  function escolherLugar(l: Lugar) {
    setPos({ lat: l.lat, lng: l.lng });
    setAproximado(false);
    if (l.ehEndereco) {
      // Escolheu só um endereço: o nome fica com o que foi digitado (se não for o próprio endereço).
      const digitado = q.trim();
      const digitouEndereco = /^(rua|avenida|praça|travessa|largo|beco|estrada)\b|\d/i.test(expandirAbreviacoes(digitado));
      setNome(digitouEndereco ? "" : digitado);
      setEndereco(l.endereco && !l.endereco.startsWith(l.nome) ? `${l.nome} – ${l.endereco}` : l.endereco || l.nome);
    } else {
      setNome(l.nome);
      setEndereco(l.endereco);
    }
    app.focar({ lat: l.lat, lng: l.lng }, 18);
  }

  const linkGoogleBusca = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${q.trim() || "restaurante"}, Centro, Rio de Janeiro`,
  )}`;

  async function estouAqui() {
    setLocalizando(true);
    try {
      const p = await minhaPosicao();
      app.setMinhaPos(p);
      app.focar(p, 18);
      setPos(p);
      if (q.trim()) setNome(q.trim());
      void enderecoDoPonto(p).then((end) => end && setEndereco(end));
    } catch (e) {
      app.avisar((e as Error).message, "erro");
    } finally {
      setLocalizando(false);
    }
  }

  function escolherNoMapa() {
    // Guarda o que já foi digitado e esconde o painel enquanto a pessoa mira no mapa.
    app.abrirAdicionar({ nome: nome || q.trim(), endereco });
    app.setEscolhendoNoMapa(true);
  }

  const duplicatas = useMemo(
    () => (pos || nome.trim().length >= 3 ? possiveisDuplicatas(app.restaurantes, nome, pos) : []),
    [app.restaurantes, nome, pos],
  );

  async function salvar() {
    if (!pos || !nome.trim()) return;
    setSalvando(true);
    const { data, error } = await getSupabase()
      .from("restaurants")
      .insert({
        nome: nome.trim(),
        lat: pos.lat,
        lng: pos.lng,
        endereco: endereco.trim() || null,
        tags: tagsSel,
        faixa_preco: faixa,
        criado_por: app.userId,
      })
      .select("id")
      .single();
    setSalvando(false);
    if (error) return app.avisar(mensagemErro(error), "erro");
    app.avisar("Rango marcado no mapa! 📍");
    await app.recarregar();
    app.fecharAdicionar();
    app.abrirRestaurante(data.id);
    app.focar(pos, 18);
    app.abrirAvaliacao(data.id);
  }

  if (app.escolhendoNoMapa) return null;

  const etapaDetalhes = pos != null;

  return (
    <Sheet
      aberto
      onFechar={app.fecharAdicionar}
      altura="cheia"
      titulo={
        <div className="flex items-center gap-1">
          {etapaDetalhes ? (
            <button
              type="button"
              onClick={() => setPos(null)}
              className="-ml-2 grid size-11 place-items-center rounded-full hover:bg-surface-2"
              aria-label="Voltar pra busca"
            >
              <ArrowLeft className="size-6" />
            </button>
          ) : null}
          <h2 className="font-display text-2xl font-extrabold">{etapaDetalhes ? "Novo rango" : "Onde você comeu?"}</h2>
        </div>
      }
      rodape={
        etapaDetalhes ? (
          <Botao className="w-full" onClick={salvar} carregando={salvando} disabled={!nome.trim()}>
            Salvar e avaliar
          </Botao>
        ) : undefined
      }
    >
      {!etapaDetalhes ? (
        <div className="flex flex-col gap-4 pt-2">
          <form onSubmit={buscarExplicito} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" />
              <input
                className={`${inputCls} pl-12`}
                placeholder="Nome, endereço ou link do Google Maps"
                aria-label="Buscar restaurante por nome, endereço ou link do Google Maps"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  if (extrairLinkMaps(e.target.value)) void lerLink(e.target.value);
                }}
                type="search"
                enterKeyHint="search"
                autoFocus
              />
            </div>
            <Botao type="submit" variant="secundario" disabled={q.trim().length < 2 || buscando || lendoLink}>
              Buscar
            </Botao>
          </form>

          <div className="grid grid-cols-2 gap-2">
            <Botao type="button" variant="secundario" onClick={escolherNoMapa}>
              <Crosshair className="size-5" /> Marcar no mapa
            </Botao>
            <Botao type="button" variant="secundario" onClick={estouAqui} carregando={localizando}>
              {!localizando ? <LocateFixed className="size-5" /> : null} Estou aqui
            </Botao>
          </div>

          {lendoLink ? (
            <p className="flex items-center gap-2 text-sm text-muted">
              <Spinner /> Lendo o link do Google Maps…
            </p>
          ) : buscando ? (
            <p className="flex items-center gap-2 text-sm text-muted">
              <Spinner /> Procurando…
            </p>
          ) : null}
          {erroBusca ? <p className="text-sm text-danger">{erroBusca}</p> : null}

          {/* Já cadastrados com nome parecido */}
          {q.trim().length >= 3 ? <AvisoDuplicata duplicatas={possiveisDuplicatas(app.restaurantes, q, null)} pos={null} /> : null}

          {resultados?.length ? (
            <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line">
              {resultados.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => escolherLugar(l)}
                    className="flex min-h-14 w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-2"
                  >
                    {l.ehEndereco ? (
                      <Signpost className="mt-0.5 size-5 shrink-0 text-muted" />
                    ) : (
                      <MapPin className="mt-0.5 size-5 shrink-0 text-brand" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{l.nome}</span>
                      <span className="block truncate text-sm text-muted">
                        {[l.ehEndereco ? "Endereço" : l.tipo, l.endereco !== l.nome ? l.endereco : null].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : resultados && !buscando ? (
            <p className="rounded-2xl bg-surface-2 p-4 text-sm">
              Não achei no OpenStreetMap. Muito lugar pequeno do Centro não está lá, mas dá pra puxar do Google Maps 👇
            </p>
          ) : null}

          {/* Plano B: Google Maps → Compartilhar → Copiar link → colar aqui */}
          {!lendoLink ? (
            <div className="rounded-2xl border border-line p-4">
              <p className="font-semibold">{resultados && !resultados.length ? "Pega do Google Maps" : "Não achou? Pega do Google Maps"}</p>
              <ol className="mt-1 list-decimal pl-5 text-sm text-muted">
                <li>Abra o lugar no Google Maps</li>
                <li>
                  Toque em <b>Compartilhar</b> → <b>Copiar link</b>
                </li>
                <li>Volte aqui e cole</li>
              </ol>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <a
                  href={linkGoogleBusca}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-line bg-surface px-3 text-sm font-semibold"
                >
                  <ExternalLink className="size-4" /> Google Maps
                </a>
                <Botao type="button" variant="secundario" className="px-3 text-sm" onClick={colarLink}>
                  <ClipboardPaste className="size-4" /> Colar link
                </Botao>
              </div>
            </div>
          ) : null}

          {!resultados ? (
            <p className="text-sm text-muted">
              Dica: no mapa, você também pode <b>segurar o dedo</b> em cima do lugar pra marcar direto.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-5 pt-2">
          <AvisoDuplicata duplicatas={duplicatas} pos={pos} />
          <div className="flex items-center justify-between gap-2 rounded-2xl bg-surface-2 px-4 py-3 text-sm">
            <span className="flex items-center gap-1.5">
              <MapPin className="size-4 shrink-0 text-brand" />
              {aproximado ? "Local aproximado (pelo endereço). Confere no mapa?" : "Local marcado no mapa"}
            </span>
            <button type="button" className="font-semibold text-sea" onClick={escolherNoMapa}>
              Ajustar
            </button>
          </div>
          <CamposRestaurante
            focarNome={!nome}
            nome={nome}
            setNome={setNome}
            endereco={endereco}
            setEndereco={setEndereco}
            tagsSel={tagsSel}
            setTagsSel={setTagsSel}
            faixa={faixa}
            setFaixa={setFaixa}
          />
        </div>
      )}
    </Sheet>
  );
}

export function EditarRestaurante({ restaurante, onFechar }: { restaurante: Restaurant; onFechar: () => void }) {
  const app = useApp();
  const [nome, setNome] = useState(restaurante.nome);
  const [endereco, setEndereco] = useState(restaurante.endereco ?? "");
  const [tagsSel, setTagsSel] = useState<string[]>(restaurante.tags);
  const [faixa, setFaixa] = useState<number | null>(restaurante.faixa_preco);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!nome.trim()) return;
    setSalvando(true);
    const { error } = await getSupabase()
      .from("restaurants")
      .update({ nome: nome.trim(), endereco: endereco.trim() || null, tags: tagsSel, faixa_preco: faixa })
      .eq("id", restaurante.id);
    setSalvando(false);
    if (error) return app.avisar(mensagemErro(error), "erro");
    app.avisar("Dados atualizados");
    await app.recarregar();
    onFechar();
  }

  return (
    <Sheet
      aberto
      onFechar={onFechar}
      altura="cheia"
      titulo={<h2 className="font-display text-2xl font-extrabold">Editar restaurante</h2>}
      rodape={
        <Botao className="w-full" onClick={salvar} carregando={salvando} disabled={!nome.trim()}>
          Salvar
        </Botao>
      }
    >
      <div className="pt-2">
        <CamposRestaurante
          nome={nome}
          setNome={setNome}
          endereco={endereco}
          setEndereco={setEndereco}
          tagsSel={tagsSel}
          setTagsSel={setTagsSel}
          faixa={faixa}
          setFaixa={setFaixa}
        />
      </div>
    </Sheet>
  );
}
