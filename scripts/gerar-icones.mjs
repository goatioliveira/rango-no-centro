// Gera os ícones do app (PWA) a partir de um SVG. Rode: node scripts/gerar-icones.mjs
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const pin = (escala) => `
  <g transform="translate(256 256) scale(${escala}) translate(-256 -256)">
    <path d="M256 70c-86 0-156 68-156 153 0 113 156 225 156 225s156-112 156-225c0-85-70-153-156-153Z" fill="#fff"/>
    <circle cx="256" cy="222" r="92" fill="#e2512a"/>
    <g stroke="#fff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" fill="none">
      <path d="M212 166v40M232 166v40M252 166v40M212 206c0 14 9 22 20 22s20-8 20-22M232 228v52"/>
      <path d="M294 166c-16 8-22 30-22 56h22v58"/>
    </g>
  </g>`;

const ondas = `
  <path d="M0 440 C 64 400, 128 400, 192 440 S 320 480, 384 440 S 480 400, 512 420 V512 H0Z" fill="#1d1712" opacity=".18"/>`;

const svg = (escala, raio) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs><clipPath id="c"><rect width="512" height="512" rx="${raio}"/></clipPath></defs>
  <g clip-path="url(#c)"><rect width="512" height="512" fill="#e2512a"/>${ondas}</g>${pin(escala)}
</svg>`;

await mkdir("public/icons", { recursive: true });
const gerar = (conteudo, tamanho, saida) => sharp(Buffer.from(conteudo)).resize(tamanho, tamanho).png().toFile(saida);

await gerar(svg(0.92, 112), 192, "public/icons/icon-192.png");
await gerar(svg(0.92, 112), 512, "public/icons/icon-512.png");
await gerar(svg(0.72, 0), 512, "public/icons/maskable-512.png");
await gerar(svg(0.86, 0), 180, "src/app/apple-icon.png");
await gerar(svg(0.92, 112), 64, "src/app/icon.png");
console.log("Ícones gerados.");
