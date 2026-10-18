"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { List, Map as MapIcon, User, Users } from "lucide-react";
import { sair } from "@/lib/supabase/client";
import { AppProvider, useApp } from "./AppProvider";
import { TelaApelido, TelaConvite } from "./Onboarding";
import { RestauranteSheet } from "./RestauranteSheet";
import { FormularioAvaliacao } from "./FormularioAvaliacao";
import { AdicionarRestaurante } from "./AdicionarRestaurante";
import { Sorteio } from "./Sorteio";
import { MapaTela } from "./map/MapaTela";
import { Logo } from "./Logo";
import { Botao, cx } from "./ui";

const ABAS = [
  { href: "/", label: "Mapa", Icon: MapIcon },
  { href: "/lista", label: "Lista", Icon: List },
  { href: "/grupo", label: "Grupo", Icon: Users },
  { href: "/eu", label: "Eu", Icon: User },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AppProvider>
      <Conteudo>{children}</Conteudo>
    </AppProvider>
  );
}

function Conteudo({ children }: { children: ReactNode }) {
  const app = useApp();

  if (app.status === "carregando") {
    return (
      <div className="grid h-full place-items-center">
        <div className="anim-pulo">
          <Logo tamanho={64} />
        </div>
      </div>
    );
  }
  if (app.status === "erro") {
    return (
      <div className="mx-auto flex h-full max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-5xl">😵</p>
        <h1 className="font-display text-2xl font-extrabold">Deu ruim ao carregar</h1>
        <p className="text-muted">{app.erro}</p>
        <Botao onClick={() => window.location.reload()}>Tentar de novo</Botao>
        <Botao
          variant="fantasma"
          onClick={sair}
        >
          Sair
        </Botao>
      </div>
    );
  }
  if (app.status === "convite") return <TelaConvite />;
  if (app.status === "apelido") return <TelaApelido />;
  return <Pronto>{children}</Pronto>;
}

function Pronto({ children }: { children: ReactNode }) {
  const app = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const noMapa = pathname === "/";

  // "Marcar no mapa" pedido de outra aba: volta pro mapa.
  useEffect(() => {
    if (app.escolhendoNoMapa && !noMapa) router.push("/");
  }, [app.escolhendoNoMapa, noMapa, router]);

  return (
    <div className="flex h-full flex-col">
      <main className="relative min-h-0 flex-1">
        {/* O mapa fica sempre montado (só escondido) pra não recarregar ao trocar de aba. */}
        <div className={cx("absolute inset-0", !noMapa && "invisible")} aria-hidden={!noMapa}>
          <MapaTela />
        </div>
        {!noMapa ? <div className="absolute inset-0 overflow-y-auto bg-bg">{children}</div> : null}
      </main>

      {!app.escolhendoNoMapa ? (
        <nav className="pb-safe shrink-0 border-t border-line bg-surface" aria-label="Navegação principal">
          <ul className="mx-auto flex max-w-xl">
            {ABAS.map(({ href, label, Icon }) => {
              const ativo = pathname === href;
              return (
                <li key={href} className="flex-1">
                  <Link
                    href={href}
                    aria-current={ativo ? "page" : undefined}
                    className={cx(
                      "flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-semibold transition",
                      ativo ? "text-brand" : "text-muted",
                    )}
                  >
                    <span className={cx("grid h-8 w-14 place-items-center rounded-full transition", ativo && "bg-brand/12")}>
                      <Icon className="size-6" strokeWidth={ativo ? 2.4 : 2} />
                    </span>
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}

      {app.selecionadoId && !app.avaliacao ? <RestauranteSheet /> : null}
      {app.avaliacao ? (
        <FormularioAvaliacao key={`${app.avaliacao.restaurantId}:${app.avaliacao.review?.id ?? "nova"}`} />
      ) : null}
      {app.adicionar ? <AdicionarRestaurante /> : null}
      {app.sorteioAberto ? <Sorteio /> : null}

      <div className="pointer-events-none fixed inset-x-0 top-0 z-[1200] flex flex-col items-center gap-2 p-3 pt-[max(12px,env(safe-area-inset-top))]">
        {app.toasts.map((t) => (
          <div
            key={t.id}
            role={t.tipo === "erro" ? "alert" : "status"}
            className={cx(
              "anim-aparece pointer-events-auto max-w-sm rounded-2xl px-4 py-3 text-sm font-semibold shadow-soft",
              t.tipo === "erro" ? "bg-danger text-white" : "bg-ink text-bg",
            )}
          >
            {t.texto}
          </div>
        ))}
      </div>
    </div>
  );
}
