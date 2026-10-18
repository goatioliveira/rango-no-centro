"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getSupabase, irParaEntrar } from "@/lib/supabase/client";
import { supabaseConfigured } from "@/lib/supabase/env";
import { EMPTY_FILTERS, type Filters, type LatLng, type Profile, type Restaurant, type Review } from "@/lib/types";

type Status = "carregando" | "convite" | "apelido" | "pronto" | "erro";

export type AddInicial = { pos?: LatLng; nome?: string; endereco?: string };
type Toast = { id: number; texto: string; tipo: "ok" | "erro" };

type AppCtx = {
  status: Status;
  erro: string | null;
  userId: string | null;
  email: string | null;
  profile: Profile | null;
  recarregarPerfil: () => Promise<void>;

  restaurantes: Restaurant[];
  membros: Profile[];
  tags: string[];
  carregandoDados: boolean;
  /** Muda sempre que algo muda no banco (realtime). Use como dependência para recarregar. */
  versao: number;
  recarregar: () => Promise<void>;

  filtros: Filters;
  setFiltros: (f: Filters | ((f: Filters) => Filters)) => void;

  selecionadoId: string | null;
  abrirRestaurante: (id: string, focar?: boolean) => void;
  fecharRestaurante: () => void;

  avaliacao: { restaurantId: string; review?: Review } | null;
  abrirAvaliacao: (restaurantId: string, review?: Review) => void;
  fecharAvaliacao: () => void;

  adicionar: AddInicial | null;
  abrirAdicionar: (inicial?: AddInicial) => void;
  fecharAdicionar: () => void;

  escolhendoNoMapa: boolean;
  setEscolhendoNoMapa: (v: boolean) => void;

  foco: (LatLng & { zoom?: number; n: number }) | null;
  focar: (pos: LatLng, zoom?: number) => void;

  minhaPos: LatLng | null;
  setMinhaPos: (p: LatLng | null) => void;

  sorteioAberto: boolean;
  setSorteioAberto: (v: boolean) => void;

  toasts: Toast[];
  avisar: (texto: string, tipo?: Toast["tipo"]) => void;
};

const Ctx = createContext<AppCtx | null>(null);

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp fora do AppProvider");
  return c;
}

export function mensagemErro(e: unknown): string {
  const msg = e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : String(e);
  if (/failed to fetch|network/i.test(msg)) return "Sem conexão. Confere a internet e tenta de novo.";
  if (/row-level security|permission denied/i.test(msg)) return "Você não tem permissão pra isso.";
  if (/limite_de_fotos/.test(msg)) return "Cada avaliação pode ter no máximo 3 fotos.";
  if (/JWT|session/i.test(msg)) return "Sua sessão expirou. Entre de novo.";
  return msg || "Algo deu errado.";
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("carregando");
  const [erro, setErro] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [restaurantes, setRestaurantes] = useState<Restaurant[]>([]);
  const [membros, setMembros] = useState<Profile[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [versao, setVersao] = useState(0);

  const [filtros, setFiltros] = useState<Filters>(EMPTY_FILTERS);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [avaliacao, setAvaliacao] = useState<AppCtx["avaliacao"]>(null);
  const [adicionar, setAdicionar] = useState<AddInicial | null>(null);
  const [escolhendoNoMapa, setEscolhendoNoMapa] = useState(false);
  const [foco, setFoco] = useState<AppCtx["foco"]>(null);
  const [minhaPos, setMinhaPos] = useState<LatLng | null>(null);
  const [sorteioAberto, setSorteioAberto] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastN = useRef(0);

  const avisar = useCallback((texto: string, tipo: Toast["tipo"] = "ok") => {
    const id = ++toastN.current;
    setToasts((t) => [...t, { id, texto, tipo }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tipo === "erro" ? 5000 : 3000);
  }, []);

  const recarregarPerfil = useCallback(async () => {
    if (!supabaseConfigured) {
      setErro("O Supabase ainda não foi configurado (.env.local). Veja o README.");
      setStatus("erro");
      return;
    }
    const supabase = getSupabase();
    try {
      const { data: auth, error: authErr } = await supabase.auth.getUser();
      if (authErr || !auth.user) {
        irParaEntrar();
        return;
      }
      setUserId(auth.user.id);
      setEmail(auth.user.email ?? null);
      const { data, error } = await supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Seu perfil não foi encontrado. Saia e entre de novo.");
      const p = data as Profile;
      setProfile(p);
      setStatus(!p.is_member || p.is_blocked ? "convite" : !p.apelido_definido ? "apelido" : "pronto");
    } catch (e) {
      setErro(mensagemErro(e));
      setStatus("erro");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial
    void recarregarPerfil();
  }, [recarregarPerfil]);

  const recarregar = useCallback(async () => {
    const supabase = getSupabase();
    const [r, m, t] = await Promise.all([
      supabase.from("restaurants_with_stats").select("*").order("created_at", { ascending: true }),
      supabase.from("profiles").select("*").order("joined_at", { ascending: true, nullsFirst: false }),
      supabase.from("tags").select("nome").order("nome"),
    ]);
    if (r.error) {
      avisar(mensagemErro(r.error), "erro");
    } else {
      setRestaurantes((r.data ?? []) as Restaurant[]);
    }
    if (!m.error) {
      const lista = (m.data ?? []) as Profile[];
      setMembros(lista);
      setProfile((atual) => lista.find((p) => p.id === atual?.id) ?? atual);
    }
    if (!t.error) setTags((t.data ?? []).map((x: { nome: string }) => x.nome));
    setCarregandoDados(false);
  }, [avisar]);

  // Carrega os dados e escuta mudanças em tempo real quando a pessoa está liberada.
  useEffect(() => {
    if (status !== "pronto") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca inicial dos dados
    void recarregar();

    let timer: ReturnType<typeof setTimeout> | undefined;
    const mudou = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        void recarregar();
        setVersao((v) => v + 1);
      }, 350);
    };

    const supabase = getSupabase();
    const canal = supabase
      .channel("rango-mudancas")
      .on("postgres_changes", { event: "*", schema: "public", table: "restaurants" }, mudou)
      .on("postgres_changes", { event: "*", schema: "public", table: "reviews" }, mudou)
      .on("postgres_changes", { event: "*", schema: "public", table: "wishlist" }, mudou)
      .on("postgres_changes", { event: "*", schema: "public", table: "review_photos" }, mudou)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, mudou)
      .subscribe();

    // Ao voltar pro app (celular desbloqueado), garante dados frescos.
    const onVisivel = () => document.visibilityState === "visible" && mudou();
    document.addEventListener("visibilitychange", onVisivel);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisivel);
      void supabase.removeChannel(canal);
    };
  }, [status, recarregar]);

  // Se a pessoa for removida do grupo enquanto usa o app, volta pra tela de convite.
  useEffect(() => {
    if (status === "pronto" && profile && (!profile.is_member || profile.is_blocked)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reage a mudança vinda do realtime
      setStatus("convite");
    }
  }, [status, profile]);

  const abrirRestaurante = useCallback(
    (id: string, focarNele = false) => {
      setSelecionadoId(id);
      if (focarNele) {
        const r = restaurantes.find((x) => x.id === id);
        if (r) setFoco((f) => ({ lat: r.lat, lng: r.lng, n: (f?.n ?? 0) + 1 }));
      }
    },
    [restaurantes],
  );

  const value: AppCtx = useMemo(
    () => ({
      status,
      erro,
      userId,
      email,
      profile,
      recarregarPerfil,
      restaurantes,
      membros,
      tags,
      carregandoDados,
      versao,
      recarregar,
      filtros,
      setFiltros,
      selecionadoId,
      abrirRestaurante,
      fecharRestaurante: () => setSelecionadoId(null),
      avaliacao,
      abrirAvaliacao: (restaurantId, review) => setAvaliacao({ restaurantId, review }),
      fecharAvaliacao: () => setAvaliacao(null),
      adicionar,
      abrirAdicionar: (inicial) => setAdicionar(inicial ?? {}),
      fecharAdicionar: () => setAdicionar(null),
      escolhendoNoMapa,
      setEscolhendoNoMapa,
      foco,
      focar: (pos, zoom) => setFoco((f) => ({ ...pos, zoom, n: (f?.n ?? 0) + 1 })),
      minhaPos,
      setMinhaPos,
      sorteioAberto,
      setSorteioAberto,
      toasts,
      avisar,
    }),
    [
      status,
      erro,
      userId,
      email,
      profile,
      recarregarPerfil,
      restaurantes,
      membros,
      tags,
      carregandoDados,
      versao,
      recarregar,
      filtros,
      selecionadoId,
      abrirRestaurante,
      avaliacao,
      adicionar,
      escolhendoNoMapa,
      foco,
      minhaPos,
      sorteioAberto,
      toasts,
      avisar,
    ],
  );

  return <Ctx value={value}>{children}</Ctx>;
}
