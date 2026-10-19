/**
 * catalog.ts — preço público do produto (catalogPrice), gravado pela tela Produtos.
 */
import { friendlyFirestoreMessage } from './firestoreErrors';

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
