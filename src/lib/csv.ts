"use client";

import { getSupabase } from "./supabase/client";
import type { Profile, Restaurant, Review } from "./types";

function celula(v: unknown): string {
  if (v == null) return "";
  const s = typeof v === "number" ? String(v).replace(".", ",") : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Baixa todas as avaliações num CSV que abre direto no Excel/Google Planilhas em português. */
export async function exportarCSV(restaurantes: Restaurant[], membros: Profile[]) {
  const { data, error } = await getSupabase()
    .from("reviews")
    .select("*")
    .order("data_visita", { ascending: false })
    .limit(10000);
  if (error) throw error;
  const reviews = (data ?? []) as Review[];
  const rest = new Map(restaurantes.map((r) => [r.id, r]));
  const pessoa = new Map(membros.map((m) => [m.id, m.apelido]));

  const cab = [
    "Restaurante",
    "Endereço",
    "Categorias",
    "Faixa de preço",
    "Média do grupo",
    "Quem avaliou",
    "Data da visita",
    "Nota geral",
    "Comida",
    "Atendimento",
    "Custo-benefício",
    "Preço pago (R$)",
    "Voltaria",
    "O que pediu",
    "Pontos positivos",
    "Pontos negativos",
    "Comentário",
    "Latitude",
    "Longitude",
  ];

  const linhas = reviews.map((rv) => {
    const r = rest.get(rv.restaurant_id);
    return [
      r?.nome,
      r?.endereco,
      r?.tags.join(", "),
      r?.faixa_preco ? "$".repeat(r.faixa_preco) : "",
      r?.media,
      pessoa.get(rv.user_id) ?? "Ex-membro",
      rv.data_visita,
      rv.nota_geral,
      rv.nota_comida,
      rv.nota_atendimento,
      rv.nota_custo_beneficio,
      rv.preco_pago,
      rv.voltaria === "nao" ? "não" : rv.voltaria,
      rv.o_que_pediu,
      rv.pontos_positivos,
      rv.pontos_negativos,
      rv.comentario,
      r?.lat,
      r?.lng,
    ];
  });

  // Restaurantes sem nenhuma avaliação também entram.
  for (const r of restaurantes) {
    if (r.num_avaliacoes === 0) {
      linhas.push([r.nome, r.endereco, r.tags.join(", "), r.faixa_preco ? "$".repeat(r.faixa_preco) : "", null, "", "", null, null, null, null, null, "", "", "", "", "", r.lat, r.lng]);
    }
  }

  const csv = "﻿" + [cab, ...linhas].map((l) => l.map(celula).join(";")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rango-no-centro-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
