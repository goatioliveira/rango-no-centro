"use client";

import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { X } from "lucide-react";
import { COR_FAIXA, faixaDaNota, formatNota } from "@/lib/format";

function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}
export { cx };

type BtnVariant = "primario" | "secundario" | "fantasma" | "perigo";

export function Botao({
  variant = "primario",
  className,
  carregando,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; carregando?: boolean }) {
  const base =
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-semibold transition active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sea";
  const variants: Record<BtnVariant, string> = {
    primario: "bg-brand text-brand-ink shadow-soft hover:bg-brand-strong",
    secundario: "bg-surface text-ink border border-line hover:bg-surface-2",
    fantasma: "text-ink hover:bg-surface-2",
    perigo: "bg-danger/10 text-danger hover:bg-danger/20",
  };
  return (
    <button className={cx(base, variants[variant], className)} disabled={props.disabled || carregando} {...props}>
      {carregando ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cx("inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent", className)}
    />
  );
}

export function NotaBadge({
  nota,
  tamanho = "md",
  className,
}: {
  nota: number | null | undefined;
  tamanho?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const cor = COR_FAIXA[faixaDaNota(nota)];
  const tam = {
    sm: "h-7 min-w-9 px-1.5 text-sm rounded-lg",
    md: "h-9 min-w-11 px-2 text-base rounded-xl",
    lg: "h-12 min-w-14 px-2.5 text-xl rounded-2xl",
    xl: "h-16 min-w-20 px-3 text-3xl rounded-3xl",
  }[tamanho];
  return (
    <span
      className={cx("inline-flex items-center justify-center font-display font-extrabold tabular-nums", tam, className)}
      style={{ background: cor.bg, color: cor.fg }}
      aria-label={nota == null ? "sem nota" : `nota ${formatNota(nota)}`}
    >
      {formatNota(nota)}
    </span>
  );
}

export function Avatar({ url, nome, tamanho = 36 }: { url: string | null | undefined; nome: string; tamanho?: number }) {
  const [erro, setErro] = useState(false);
  const iniciais = nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  const style = { width: tamanho, height: tamanho, fontSize: tamanho * 0.4 };
  if (url && !erro) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setErro(true)}
        className="shrink-0 rounded-full object-cover ring-2 ring-surface"
        style={style}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="inline-grid shrink-0 place-items-center rounded-full bg-sea font-display font-bold text-white ring-2 ring-surface"
      style={style}
    >
      {iniciais || "?"}
    </span>
  );
}

export function Chip({
  ativo,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { ativo?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      className={cx(
        "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition active:scale-95",
        ativo ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * Painel que sobe de baixo (bottom sheet). Arraste a alça pra baixo ou toque fora para fechar.
 */
export function Sheet({
  aberto,
  onFechar,
  titulo,
  children,
  rodape,
  altura = "auto",
  semFundo,
}: {
  aberto: boolean;
  onFechar: () => void;
  titulo?: ReactNode;
  children: ReactNode;
  rodape?: ReactNode;
  altura?: "auto" | "cheia";
  semFundo?: boolean;
}) {
  const [arrasto, setArrasto] = useState(0);
  const inicio = useRef<number | null>(null);
  const tituloId = useId();
  const painel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", onKey);
    painel.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [aberto, onFechar]);

  if (!aberto) return null;

  const onPointerDown = (e: React.PointerEvent) => {
    inicio.current = e.clientY;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (inicio.current == null) return;
    setArrasto(Math.max(0, e.clientY - inicio.current));
  };
  const onPointerUp = () => {
    if (arrasto > 110) onFechar();
    inicio.current = null;
    setArrasto(0);
  };

  return (
    <div className="fixed inset-0 z-[1000] flex flex-col justify-end" role="presentation">
      <div
        className={cx("anim-aparece absolute inset-0", semFundo ? "bg-black/10" : "bg-black/45")}
        onClick={onFechar}
        aria-hidden
      />
      <div
        ref={painel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titulo ? tituloId : undefined}
        tabIndex={-1}
        className={cx(
          "anim-sobe relative mx-auto flex w-full max-w-xl flex-col rounded-t-[28px] bg-surface shadow-soft outline-none",
          altura === "cheia" ? "h-[94dvh]" : "max-h-[88dvh]",
        )}
        style={{ transform: arrasto ? `translateY(${arrasto}px)` : undefined, transition: arrasto ? "none" : undefined }}
      >
        <div
          className="flex shrink-0 cursor-grab touch-none flex-col items-center pt-2.5"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <span className="h-1.5 w-11 rounded-full bg-line" aria-hidden />
          <div className="flex w-full items-start gap-2 px-5 pt-2 pb-1">
            <div className="min-w-0 flex-1" id={tituloId}>
              {titulo}
            </div>
            <button
              type="button"
              onClick={onFechar}
              onPointerDown={(e) => e.stopPropagation()}
              className="-mr-2 grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2"
              aria-label="Fechar"
            >
              <X className="size-6" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {rodape ? (
          <div className="shrink-0 border-t border-line bg-surface px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
            {rodape}
          </div>
        ) : (
          <div className="pb-safe" />
        )}
      </div>
    </div>
  );
}

export function Vazio({ emoji, titulo, texto, acao }: { emoji: string; titulo: string; texto?: string; acao?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="anim-pulo mb-3 text-5xl" aria-hidden>
        {emoji}
      </div>
      <h3 className="font-display text-xl font-bold">{titulo}</h3>
      {texto ? <p className="mt-1 max-w-xs text-muted">{texto}</p> : null}
      {acao ? <div className="mt-5">{acao}</div> : null}
    </div>
  );
}

export function Campo({
  label,
  dica,
  children,
  htmlFor,
}: {
  label: string;
  dica?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {dica ? <p className="text-xs text-muted">{dica}</p> : null}
    </div>
  );
}

export const inputCls =
  "min-h-12 w-full rounded-2xl border border-line bg-bg px-4 text-base text-ink placeholder:text-muted/70 focus:border-sea focus:outline-none focus:ring-3 focus:ring-sea/25";
