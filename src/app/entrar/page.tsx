import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { BotaoGoogle } from "./BotaoGoogle";
import { supabaseConfigured } from "@/lib/supabase/env";

export const metadata = { title: "Entrar · Rango no Centro" };

export default function EntrarPage() {
  return (
    <main className="calcadao flex min-h-full flex-col">
      <div className="pt-safe mx-auto flex w-full max-w-md flex-1 flex-col justify-between px-6 py-10">
        <div className="mt-10 flex flex-col items-start gap-5">
          <Logo tamanho={72} />
          <h1 className="font-display text-5xl leading-[0.95] font-extrabold tracking-tight">
            Rango
            <br />
            <span className="text-brand">no Centro</span>
          </h1>
          <p className="max-w-xs text-lg text-muted">
            O mapa do almoço da galera. Do PF da Carioca ao boteco da Ouvidor, tudo com nota de quem foi.
          </p>
        </div>

        <div className="flex flex-col gap-3 pb-[env(safe-area-inset-bottom)]">
          {supabaseConfigured ? (
            <Suspense>
              <BotaoGoogle />
            </Suspense>
          ) : (
            <div className="rounded-2xl border border-line bg-surface p-4 text-sm">
              <p className="font-semibold">Falta configurar o Supabase.</p>
              <p className="mt-1 text-muted">
                Copie <code>.env.example</code> para <code>.env.local</code> e preencha a URL e a chave pública do
                projeto. Veja o README.
              </p>
            </div>
          )}
          <p className="text-center text-xs text-muted">Só pra galera convidada. Você vai precisar do código do grupo.</p>
        </div>
      </div>
    </main>
  );
}
