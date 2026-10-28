// Estacionamento item 12: os ícones do app instalado (manifesto em vite.config.ts) existem e têm o tamanho declarado.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ICONS = [
  { file: 'pwa-192x192.png', size: 192 },
  { file: 'pwa-512x512.png', size: 512 },
];

describe('ícones do app instalado', () => {
  for (const { file, size } of ICONS) {
    it(`${file} é um PNG de ${size}x${size}`, () => {
      const png = readFileSync(resolve(__dirname, '../../public', file));
      expect(png.subarray(1, 4).toString()).toBe('PNG');
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([size, size]);
    });
  }

  it('o manifesto (public/manifest.webmanifest) aponta para esses arquivos', () => {
    const manifest = JSON.parse(readFileSync(resolve(__dirname, '../../public/manifest.webmanifest'), 'utf8'));
    for (const { file, size } of ICONS)
      expect(manifest.icons).toContainEqual({ src: file, sizes: `${size}x${size}`, type: 'image/png' });
  });
  // Correção de 28/10/2026: o index.html serve todas as páginas, inclusive o catálogo público; o manifesto é posto
  // só pelo main.tsx, fora do catálogo.
  it('o index.html não traz o link do manifesto', () => {
    const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8');
    expect(html).not.toContain('rel="manifest"');
  });
});
