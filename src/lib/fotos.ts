"use client";

import { getSupabase } from "./supabase/client";

export const MAX_FOTOS = 3;
const LADO_MAX = 1600;
const QUALIDADE = 0.8;

/** Reduz a foto no próprio celular antes de enviar (economiza dados e espaço). */
export async function comprimirFoto(arquivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * escala);
  const h = Math.round(bitmap.height * escala);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não deu pra processar a foto.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALIDADE));
  if (!blob) throw new Error("Não deu pra processar a foto.");
  return blob;
}

export async function enviarFotos(userId: string, reviewId: string, arquivos: File[]) {
  const supabase = getSupabase();
  for (const arquivo of arquivos) {
    const blob = await comprimirFoto(arquivo);
    const path = `${userId}/${reviewId}/${crypto.randomUUID()}.jpg`;
    const up = await supabase.storage.from("fotos").upload(path, blob, { contentType: "image/jpeg" });
    if (up.error) throw up.error;
    const ins = await supabase.from("review_photos").insert({ review_id: reviewId, user_id: userId, path });
    if (ins.error) {
      await supabase.storage.from("fotos").remove([path]);
      throw ins.error;
    }
  }
}

export async function apagarFotos(paths: string[]) {
  if (!paths.length) return;
  await getSupabase().storage.from("fotos").remove(paths);
}
