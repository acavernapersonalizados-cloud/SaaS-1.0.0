/**
 * quantity.ts — quantidades de estoque com fração (Estacionamento item 25, 2/11/2026). Aceita vírgula ou ponto
 * ("0,5", "0.5", "0,125", "1.000,5") e converte kg ↔ g, l ↔ ml e m ↔ cm. Guarda até 6 casas.
 */

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/**
 * Texto digitado → número (null = vazio ou inválido). Com vírgula, ela é a decimal e o ponto é milhar
 * ("1.000,5" = 1000,5). Sem vírgula: mais de um ponto é milhar ("1.000.000"); um ponto com exatamente 3 algarismos
 * depois e parte inteira de 1 ou mais também é milhar, como se escreve no Brasil ("1.000" = 1000, "1.500" = 1500);
 * nos outros casos o ponto é decimal ("1.5", "0.125"). Valores de 100 ou mais em kg/l/m pedem confirmação.
 */
export function parseQuantity(text: string): number | null {
  let s = String(text ?? '')
    .trim()
    .replace(/\s+/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if ((s.match(/\./g) || []).length > 1 || /^[1-9]\d*\.\d{3}$/.test(s)) s = s.replace(/\./g, '');
  if (!/^\d*\.?\d+$/.test(s) && !/^\d+\.$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? round6(n) : null;
}

/** Unidade menor para digitar: kg → g, l → ml, m → cm. */
export function subUnitOf(unit: string | undefined): { unit: string; factor: number } | null {
  switch ((unit || '').toLowerCase()) {
    case 'kg':
      return { unit: 'g', factor: 1000 };
    case 'l':
      return { unit: 'ml', factor: 1000 };
    case 'm':
      return { unit: 'cm', factor: 100 };
    default:
      return null;
  }
}

/**
 * Número para a tela, em português (até 6 casas): 0,5 · 1.000 · 0,125. Dentro de campo de digitar, sem o ponto de
 * milhar (`grouping: false` → "2000"), para o texto voltar igual ao ser lido.
 */
export const formatQuantity = (n: number, { grouping = true }: { grouping?: boolean } = {}) =>
  round6(Number(n) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 6, useGrouping: grouping });

/** "0,5 kg = 500 g" (vazio quando a unidade não tem a menor). */
export function equivalentText(n: number, unit: string | undefined): string {
  const sub = subUnitOf(unit);
  if (!sub) return '';
  return `${formatQuantity(n)} ${unit} = ${formatQuantity(n * sub.factor)} ${sub.unit}`;
}

/**
 * Trava do item 25: em kg, l ou m, 100 ou mais pede confirmação (quem quis digitar 500 g pode ter digitado 500 kg).
 * Devolve a pergunta, ou null quando não precisa.
 */
export function bigQuantityQuestion(n: number, unit: string | undefined): string | null {
  const sub = subUnitOf(unit);
  if (!sub || !(Number(n) >= 100)) return null;
  return `${equivalentText(n, unit)}, confirma?`;
}

/** Pergunta (window.confirm) quando precisa; true = pode seguir. */
export function confirmBigQuantity(n: number, unit: string | undefined): boolean {
  const q = bigQuantityQuestion(n, unit);
  return q === null || window.confirm(q);
}
