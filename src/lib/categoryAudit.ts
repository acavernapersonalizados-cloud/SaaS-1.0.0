/**
 * categoryAudit.ts — "Organizar categorias" (Estacionamento item 14, aprovado em 27/10/2026).
 * Junta as grafias do antigo campo de texto livre dos produtos ("Presente ", "presente", "Presentes"…), sugere a
 * categoria oficial de cada grupo e monta o plano do que muda. Nada aqui grava: quem grava é a tela, com o clique.
 */
import type { Category, Product } from '../types';

/** Grafia sem maiúscula, acento, espaços sobrando e plural com "s" no fim: "VESTUÁRIO " e "vestuario" viram iguais. */
export function categoryKey(text: string): string {
  const k = (text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  return k.length > 3 && k.endsWith('s') ? k.slice(0, -1) : k;
}

/** O texto livre podia ter várias categorias separadas por vírgula ("Presente, cesta"). */
export const splitCategoryText = (text: string | undefined) =>
  (text || '')
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);

/** Quantas letras trocar, pôr ou tirar para uma virar a outra (para "Presenta" → "Presente"). */
function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return prev[b.length];
}

/** Categoria oficial que combina com a grafia: igual; ou começa com ela ("Papelaria Personalizada"); ou 1 letra de diferença. */
export function suggestOfficial(key: string, officials: Category[]): Category | null {
  const keyed = officials.map(c => ({ c, k: categoryKey(c.name) }));
  return (
    keyed.find(o => o.k === key)?.c ??
    keyed.find(o => o.k && key.startsWith(o.k + ' '))?.c ??
    keyed.find(o => o.k.length >= 5 && key.length >= 5 && editDistance(o.k, key) <= 1)?.c ??
    null
  );
}

export interface CategoryGroup {
  /** Grafia normalizada (categoryKey). */
  key: string;
  /** Como aparece nos produtos, a mais usada primeiro. */
  spellings: Array<{ text: string; count: number }>;
  /** Produtos que têm essa grafia no texto livre. */
  productIds: string[];
  /** Categoria oficial sugerida, ou null quando nenhuma combina. */
  suggestedCategoryId: string | null;
  /** Nome para uma categoria nova (a grafia mais usada). */
  suggestedName: string;
}

/** Grupos de grafias do texto livre de todos os produtos da loja (inclusive os ocultos do catálogo). */
export function buildCategoryGroups(products: Product[], officials: Category[]): CategoryGroup[] {
  const byKey = new Map<string, { spellings: Map<string, number>; productIds: Set<string> }>();
  for (const p of products) {
    for (const text of splitCategoryText(p.category)) {
      const key = categoryKey(text);
      if (!key) continue;
      const g = byKey.get(key) ?? { spellings: new Map(), productIds: new Set() };
      g.spellings.set(text, (g.spellings.get(text) ?? 0) + 1);
      g.productIds.add(p.id);
      byKey.set(key, g);
    }
  }
  return [...byKey]
    .map(([key, g]) => {
      const spellings = [...g.spellings]
        .map(([text, count]) => ({ text, count }))
        .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text));
      return {
        key,
        spellings,
        productIds: [...g.productIds],
        suggestedCategoryId: suggestOfficial(key, officials)?.id ?? null,
        suggestedName: spellings[0].text,
      };
    })
    .sort((a, b) => b.productIds.length - a.productIds.length || a.key.localeCompare(b.key));
}

/**
 * Grupos que ainda pedem atenção: sem categoria oficial parecida, ou com algum produto que ainda não está na oficial
 * sugerida (ou com o texto diferente do nome oficial). Depois de organizado, o grupo some daqui.
 */
export function pendingCategoryGroups(products: Product[], officials: Category[]): CategoryGroup[] {
  return buildCategoryGroups(products, officials).filter(g => {
    if (!g.suggestedCategoryId) return true;
    const inGroup = products.filter(p => g.productIds.includes(p.id));
    return planCategoryUnification(inGroup, { [g.key]: g.suggestedCategoryId }, officials).length > 0;
  });
}

export interface ProductCategoryUpdate {
  productId: string;
  categoryIds: string[];
  category: string;
}

/**
 * O que muda em cada produto com as escolhas da pessoa (grafia → id da categoria oficial; sem escolha = não mexer):
 * a categoria oficial entra em categoryIds e o texto livre passa a ser o nome das oficiais (o que ficou sem escolha
 * continua no texto). Produto sem nada a mudar não entra no plano.
 */
export function planCategoryUnification(
  products: Product[],
  choices: Record<string, string>,
  officials: Category[],
): ProductCategoryUpdate[] {
  const nameOf = (id: string) => officials.find(c => c.id === id)?.name;
  const updates: ProductCategoryUpdate[] = [];
  for (const p of products) {
    const texts = splitCategoryText(p.category);
    const mapped = texts.map(t => choices[categoryKey(t)]).filter((id): id is string => !!id && !!nameOf(id));
    if (mapped.length === 0) continue;
    const current = p.categoryIds || [];
    const categoryIds = [...new Set([...current, ...mapped])];
    const officialNames = categoryIds.map(nameOf).filter((n): n is string => !!n);
    const leftovers = texts.filter(t => !choices[categoryKey(t)]);
    const category = [...officialNames, ...leftovers].join(', ');
    const sameIds = categoryIds.length === current.length && categoryIds.every(id => current.includes(id));
    if (sameIds && category === (p.category || '')) continue;
    updates.push({ productId: p.id, categoryIds, category });
  }
  return updates;
}
