"use client";

import { useEffect, useState } from "react";
import { Copy, Download, KeyRound, LogOut, Share2, Shield, ShieldOff, UserMinus, UserPlus } from "lucide-react";
import { getSupabase, sair } from "@/lib/supabase/client";
import { mensagemErro, useApp } from "@/components/AppProvider";
import { Avatar, Botao, Campo, inputCls } from "@/components/ui";
import { exportarCSV } from "@/lib/csv";

export default function EuPage() {
  const app = useApp();
  const { profile, email } = app;
  const [apelido, setApelido] = useState(profile?.apelido ?? "");
  const [salvando, setSalvando] = useState(false);
  const [exportando, setExportando] = useState(false);

  if (!profile) return null;
  const usandoFoto = Boolean(profile.avatar_url);

  async function salvarPerfil(mudancas: { apelido?: string; avatar_url?: string | null }) {
    setSalvando(true);
    const { error } = await getSupabase().from("profiles").update(mudancas).eq("id", profile!.id);
    setSalvando(false);
    if (error) return app.avisar(mensagemErro(error), "erro");
    app.avisar("Perfil atualizado");
    await app.recarregar();
  }

  async function exportar() {
    setExportando(true);
    try {
      await exportarCSV(app.restaurantes, app.membros);
    } catch (e) {
      app.avisar(mensagemErro(e), "erro");
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <header className="calcadao pt-safe border-b border-line">
        <div className="flex items-center gap-4 px-4 pt-6 pb-5">
          <Avatar url={profile.avatar_url} nome={profile.apelido} tamanho={64} />
          <div className="min-w-0">
            <h1 className="truncate font-display text-3xl font-extrabold">{profile.apelido}</h1>
            <p className="truncate text-sm text-muted">
              {email}
              {profile.is_admin ? " · admin" : ""}
            </p>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-8 p-4">
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-xl font-bold">Seu perfil</h2>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (apelido.trim()) void salvarPerfil({ apelido: apelido.trim().slice(0, 40) });
            }}
          >
            <div className="flex-1">
              <Campo label="Apelido" htmlFor="eu-apelido">
                <input id="eu-apelido" className={inputCls} value={apelido} maxLength={40} onChange={(e) => setApelido(e.target.value)} />
              </Campo>
            </div>
            <Botao type="submit" variant="secundario" className="self-end" carregando={salvando} disabled={!apelido.trim() || apelido.trim() === profile.apelido}>
              Salvar
            </Botao>
          </form>
          {profile.google_avatar_url ? (
            <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-line bg-surface px-4">
              <input
                type="checkbox"
                className="size-5 accent-[var(--brand)]"
                checked={usandoFoto}
                disabled={salvando}
                onChange={(e) => salvarPerfil({ avatar_url: e.target.checked ? profile.google_avatar_url : null })}
              />
              <span>Usar minha foto do Google</span>
            </label>
          ) : null}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-bold">Dados</h2>
          <Botao variant="secundario" onClick={exportar} carregando={exportando} className="justify-start">
            {!exportando ? <Download className="size-5" /> : null} Exportar tudo em CSV
          </Botao>
          <p className="text-xs text-muted">Abre no Excel ou no Google Planilhas. Inclui todas as avaliações do grupo.</p>
        </section>

        {profile.is_admin ? <PainelAdmin /> : null}

        <section className="flex flex-col gap-3">
          <Botao
            variant="perigo"
            onClick={sair}
          >
            <LogOut className="size-5" /> Sair da conta
          </Botao>
          <p className="text-center text-xs text-muted">
            Rango no Centro · mapa © colaboradores do OpenStreetMap
          </p>
        </section>
      </div>
    </div>
  );
}

function PainelAdmin() {
  const app = useApp();
  const supabase = getSupabase();
  const [codigo, setCodigo] = useState<string | null>(null);
  const [novo, setNovo] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    void supabase.rpc("admin_get_invite_code").then(({ data, error }) => {
      if (error) app.avisar(mensagemErro(error), "erro");
      else setCodigo(data as string);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function trocarCodigo(e: React.FormEvent) {
    e.preventDefault();
    if (novo.trim().length < 4) return app.avisar("O código precisa ter pelo menos 4 caracteres.", "erro");
    setSalvando(true);
    const { error } = await supabase.rpc("admin_set_invite_code", { p_code: novo.trim() });
    setSalvando(false);
    if (error) return app.avisar(mensagemErro(error), "erro");
    setCodigo(novo.trim());
    setNovo("");
    app.avisar("Código trocado. O antigo não funciona mais.");
  }

  async function compartilhar() {
    const texto = `Bora pro Rango no Centro! Entra em ${window.location.origin} com sua conta Google e usa o código: ${codigo}`;
    try {
      if (navigator.share) await navigator.share({ title: "Rango no Centro", text: texto });
      else {
        await navigator.clipboard.writeText(texto);
        app.avisar("Convite copiado! Cola no grupo do zap.");
      }
    } catch {
      // pessoa cancelou o compartilhamento
    }
  }

  async function acao(nome: string, args: Record<string, unknown>, ok: string, confirmar?: string) {
    if (confirmar && !confirm(confirmar)) return;
    const { error } = await supabase.rpc(nome, args);
    if (error) return app.avisar(mensagemErro(error), "erro");
    app.avisar(ok);
    await app.recarregar();
  }

  const membros = app.membros.filter((m) => m.is_member && !m.is_blocked);
  // Bloqueados por um admin ou travados por errar o código 10 vezes.
  const bloqueados = app.membros.filter((m) => m.is_blocked || (!m.is_member && m.convite_tentativas >= 10));

  return (
    <section className="flex flex-col gap-4 rounded-3xl border-2 border-sea/40 p-4">
      <h2 className="flex items-center gap-2 font-display text-xl font-bold">
        <Shield className="size-5 text-sea" /> Área do admin
      </h2>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold">Código de convite atual</p>
        <div className="flex items-center gap-2">
          <code className="flex min-h-12 flex-1 items-center rounded-2xl bg-surface-2 px-4 font-mono text-lg">
            {codigo ?? "…"}
          </code>
          <Botao
            variant="secundario"
            aria-label="Copiar código"
            className="px-4"
            onClick={async () => {
              if (!codigo) return;
              await navigator.clipboard.writeText(codigo);
              app.avisar("Código copiado");
            }}
          >
            <Copy className="size-5" />
          </Botao>
        </div>
        <Botao onClick={compartilhar} disabled={!codigo}>
          <Share2 className="size-5" /> Convidar alguém
        </Botao>
      </div>

      <form onSubmit={trocarCodigo} className="flex flex-col gap-2">
        <Campo label="Trocar o código" htmlFor="novo-codigo" dica="Quem já está no grupo continua. Só quem for entrar daqui pra frente precisa do novo.">
          <div className="flex gap-2">
            <input
              id="novo-codigo"
              className={inputCls}
              value={novo}
              onChange={(e) => setNovo(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="novo-codigo"
            />
            <Botao type="submit" variant="secundario" carregando={salvando} disabled={novo.trim().length < 4}>
              <KeyRound className="size-5" />
            </Botao>
          </div>
        </Campo>
      </form>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold">Membros ({membros.length})</p>
        <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
          {membros.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-3 py-2.5">
              <Avatar url={m.avatar_url} nome={m.apelido} tamanho={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{m.apelido}</p>
                <p className="text-xs text-muted">{m.is_admin ? "admin" : "membro"}</p>
              </div>
              {m.id !== app.userId ? (
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="grid size-10 place-items-center rounded-xl hover:bg-surface-2"
                    aria-label={m.is_admin ? `Tirar admin de ${m.apelido}` : `Tornar ${m.apelido} admin`}
                    title={m.is_admin ? "Tirar admin" : "Tornar admin"}
                    onClick={() =>
                      acao(
                        "admin_set_admin",
                        { p_user: m.id, p_admin: !m.is_admin },
                        m.is_admin ? `${m.apelido} não é mais admin` : `${m.apelido} agora é admin`,
                      )
                    }
                  >
                    {m.is_admin ? <ShieldOff className="size-5" /> : <Shield className="size-5" />}
                  </button>
                  <button
                    type="button"
                    className="grid size-10 place-items-center rounded-xl text-danger hover:bg-danger/10"
                    aria-label={`Remover ${m.apelido} do grupo`}
                    title="Remover do grupo"
                    onClick={() =>
                      acao(
                        "admin_remove_member",
                        { p_user: m.id },
                        `${m.apelido} foi removido(a)`,
                        `Remover ${m.apelido} do grupo? A pessoa perde o acesso na hora e não consegue voltar nem com o código (até você desbloquear). As avaliações dela continuam no mapa.`,
                      )
                    }
                  >
                    <UserMinus className="size-5" />
                  </button>
                </div>
              ) : (
                <span className="text-xs text-muted">você</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {bloqueados.length ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">Bloqueados ({bloqueados.length})</p>
          <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
            {bloqueados.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                <Avatar url={m.avatar_url} nome={m.apelido} tamanho={36} />
                <p className="min-w-0 flex-1 truncate">{m.apelido}</p>
                <Botao
                  variant="secundario"
                  className="min-h-10 px-3 text-sm"
                  onClick={() =>
                    acao("admin_unblock_member", { p_user: m.id }, `${m.apelido} desbloqueado(a). Pode entrar de novo com o código.`)
                  }
                >
                  <UserPlus className="size-4" /> Desbloquear
                </Botao>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
