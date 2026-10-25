/**
 * catalog.ts — preço público do produto (catalogPrice), gravado pela tela Produtos.
 */
import type { CatalogPriceDisplay } from '../types';
import { friendlyFirestoreMessage } from './firestoreErrors';
import { creditPrice } from './pricingEngine';

/** O que o catálogo mostra (Etapa 8C): a opção da loja ou, sem ela, o preço no Pix. */
export function catalogPriceDisplayOf(
  store: { catalogPriceDisplay?: CatalogPriceDisplay } | null | undefined,
): CatalogPriceDisplay {
  const d = store?.catalogPriceDisplay;
  return d === 'credito' || d === 'ambos' ? d : 'pix';
}

/** Linhas de preço do catálogo: o preço gravado (catalogPrice) é o do Pix; o crédito é Pix ÷ 0,95. */
export function catalogPriceLines(pixPrice: number, display: CatalogPriceDisplay) {
  const pix = { label: 'no Pix', value: pixPrice };
  const credit = { label: 'no crédito', value: creditPrice(pixPrice) };
  if (display === 'credito') return [credit];
  if (display === 'ambos') return [pix, credit];
  return [pix];
}

/** Aviso único de uma rodada da sincronização do catálogo, ou null se nada falhou. */
export function catalogSyncFailureMessage(errors: unknown[]): string | null {
  if (errors.length === 0) return null;
  const n = errors.length;
  return `Não foi possível atualizar o preço do catálogo de ${n} ${n === 1 ? 'produto' : 'produtos'}: ${friendlyFirestoreMessage(errors[0])}`;
}

/**
 * Preço a gravar no catálogo, ou null para não gravar nada.
 * Só grava um preço válido (> 0) e diferente do gravado: um preço existente nunca é trocado
 * por R$ 0 (ex.: meta de lucro inválida na Base de Custos deixa o preço calculado em zero).
 */
export function nextCatalogPrice(stored: number | null | undefined, computed: number): number | null {
  if (!Number.isFinite(computed) || computed <= 0) return null;
  if (Math.abs(computed - (Number(stored) || 0)) <= 0.01) return null;
  return computed;
}
