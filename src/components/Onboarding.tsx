"use client";

import { useState } from "react";
import { getSupabase, sair } from "@/lib/supabase/client";
import { Avatar, Botao, Campo, inputCls } from "./ui";
import { Logo } from "./Logo";
import { mensagemErro, useApp } from "./AppProvider";

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <main className="calcadao flex min-h-full flex-col">
      <div className="pt-safe mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-10">{children}</div>
    </main>
  );
}

export function TelaConvite() {
  const { profile, email, recarregarPerfil } = useApp();
  const [codigo, setCodigo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (profile?.is_blocked) {
    return (
      <Moldura>
        <div className="mt-16 flex flex-col gap-4">
          <div className="text-5xl">🚪</div>
          <h1 className="font-display text-3xl font-extrabold">Seu acesso foi removido</h1>
          <p className="text-muted">
            Um admin do grupo tirou sua conta ({email}). Se foi engano, fala com ele pra te liberar de novo.
          </p>
          <Botao variant="secundario" onClick={sair}>
            Sair
          </Botao>
        </div>
      </Moldura>
    );
  }

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    if (!codigo.trim()) return;
    setEnviando(true);
    setErro(null);
    const { data, error } = await getSupabase().rpc("join_group", { p_code: codigo });
    setEnviando(false);
    if (error) {
      setErro(
        /muitas_tentativas/.test(error.message)
          ? "Muitas tentativas erradas. Pede pra um admin te liberar."
          : /bloqueado/.test(error.message)
            ? "Seu acesso foi bloqueado por um admin."
            : mensagemErro(error),
      );
      return;
    }
    if (!data) {
      setErro("Código errado. Confere com quem te chamou pro grupo.");
      return;
    }
    await recarregarPerfil();
  }

  return (
    <Moldura>
      <form onSubmit={entrar} className="mt-10 flex flex-1 flex-col gap-6">
        <Logo tamanho={56} />
        <div>
          <h1 className="font-display text-3xl leading-tight font-extrabold">Qual é o código do grupo?</h1>
          <p className="mt-2 text-muted">
            O Rango é fechado pra galera. Pede o código pra quem te chamou — você só digita uma vez.
          </p>
        </div>
        <Campo label="Código de convite" htmlFor="codigo">
          <input
            id="codigo"
            className={`${inputCls} min-h-14 text-lg tracking-wide`}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            placeholder="ex.: bora-almocar"
            autoFocus
          />
        </Campo>
        {erro ? (
          <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">
            {erro}
          </p>
        ) : null}
        <div className="mt-auto flex flex-col gap-2 pb-[env(safe-area-inset-bottom)]">
          <Botao type="submit" carregando={enviando} className="min-h-14 text-base">
            Entrar no grupo
          </Botao>
          <Botao type="button" variant="fantasma" onClick={sair}>
            Usar outra conta ({email})
          </Botao>
        </div>
      </form>
    </Moldura>
  );
}

export function TelaApelido() {
  const { profile, recarregarPerfil } = useApp();
  const [apelido, setApelido] = useState(profile?.apelido ?? "");
  const [usarFoto, setUsarFoto] = useState(Boolean(profile?.google_avatar_url));
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const nome = apelido.trim();
    if (!nome || !profile) return;
    setEnviando(true);
    const { error } = await getSupabase()
      .from("profiles")
      .update({
        apelido: nome.slice(0, 40),
        avatar_url: usarFoto ? profile.google_avatar_url : null,
        apelido_definido: true,
      })
      .eq("id", profile.id);
    setEnviando(false);
    if (error) {
      setErro(mensagemErro(error));
      return;
    }
    await recarregarPerfil();
  }

  return (
    <Moldura>
      <form onSubmit={salvar} className="mt-10 flex flex-1 flex-col gap-6">
        <div>
          <p className="font-semibold text-brand">Bem-vindo(a) ao grupo! 🎉</p>
          <h1 className="mt-1 font-display text-3xl leading-tight font-extrabold">Como a galera te chama?</h1>
          <p className="mt-2 text-muted">Esse apelido aparece nas suas avaliações.</p>
        </div>
        <div className="flex items-center gap-4">
          <Avatar url={usarFoto ? profile?.google_avatar_url : null} nome={apelido || "?"} tamanho={64} />
          <div className="flex-1">
            <Campo label="Apelido" htmlFor="apelido">
              <input
                id="apelido"
                className={inputCls}
                value={apelido}
                maxLength={40}
                onChange={(e) => setApelido(e.target.value)}
                autoFocus
              />
            </Campo>
          </div>
        </div>
        {profile?.google_avatar_url ? (
          <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-line bg-surface px-4">
            <input
              type="checkbox"
              className="size-5 accent-[var(--brand)]"
              checked={usarFoto}
              onChange={(e) => setUsarFoto(e.target.checked)}
            />
            <span>Usar minha foto do Google</span>
          </label>
        ) : null}
        {erro ? (
          <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">
            {erro}
          </p>
        ) : null}
        <div className="mt-auto pb-[env(safe-area-inset-bottom)]">
          <Botao type="submit" carregando={enviando} disabled={!apelido.trim()} className="min-h-14 w-full text-base">
            Bora pro mapa
          </Botao>
        </div>
      </form>
    </Moldura>
  );
}
