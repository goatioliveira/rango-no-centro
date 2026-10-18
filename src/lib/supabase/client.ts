"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "./env";

let client: SupabaseClient | undefined;

export function getSupabase(): SupabaseClient {
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
  return client;
}

/** Recarrega a página inteira na tela de login (zera todo o estado do app). */
export function irParaEntrar() {
  window.location.assign(new URL("/entrar", window.location.origin));
}

export async function sair() {
  await getSupabase().auth.signOut();
  irParaEntrar();
}
