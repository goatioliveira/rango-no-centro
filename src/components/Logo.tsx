export function Logo({ tamanho = 56 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="90 62 332 396" aria-hidden>
      <path d="M256 70c-86 0-156 68-156 153 0 113 156 225 156 225s156-112 156-225c0-85-70-153-156-153Z" fill="var(--brand)" />
      <circle cx="256" cy="222" r="92" fill="var(--surface)" />
      <g stroke="var(--ink)" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M212 166v40M232 166v40M252 166v40M212 206c0 14 9 22 20 22s20-8 20-22M232 228v52" />
        <path d="M294 166c-16 8-22 30-22 56h22v58" />
      </g>
    </svg>
  );
}

export function Marca() {
  return (
    <div className="flex items-center gap-2">
      <Logo tamanho={30} />
      <span className="font-display text-xl leading-none font-extrabold tracking-tight">
        Rango <span className="text-brand">no Centro</span>
      </span>
    </div>
  );
}
