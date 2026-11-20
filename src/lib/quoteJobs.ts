/**
 * quoteJobs.ts — item 34 (20/11/2026): trabalho salvo de calculadora entra direto no orçamento, sem virar produto.
 * O trabalho vira um "produto" só na memória da tela (id `job:<calculadora>:<id>`), com o custo e o preço gravados no
 * trabalho (o mesmo do "Virar produto"); nada é gravado em `products`. O item do orçamento guarda a receita do
 * trabalho (`jobRecipe`), que reserva e baixa o estoque ao aprovar, como a de um produto.
 */
import type { JobKind, Product, ProductMaterial } from '../types';
import { type ConvertibleJob, jobProductBlock, productFromJob } from './jobProduct';

export const JOB_ITEM_PREFIX = 'job:';

/** Nome curto de cada calculadora, mostrado junto do trabalho. */
export const JOB_KIND_LABEL: Record<JobKind, string> = {
  laser: 'Laser',
  print3d: '3D',
  papelaria: 'Papelaria',
  cestas: 'Cestas',
  sublimacao: 'Sublimação',
};

export const jobItemId = (kind: JobKind, id: string) => `${JOB_ITEM_PREFIX}${kind}:${id}`;
export const isJobItemId = (id: string | undefined | null) => !!id && id.startsWith(JOB_ITEM_PREFIX);

/** Ids de materiais do filamento de um trabalho da 3D (os novos têm vários; os antigos, um só). */
export function jobFilamentIds(job: ConvertibleJob): string[] {
  const j = job as unknown as { filaments?: Array<{ materialId?: string | null }>; materialId?: string | null };
  const ids = (j.filaments ?? []).map(f => f.materialId).filter((id): id is string => !!id);
  if (j.materialId) ids.push(j.materialId);
  return [...new Set(ids)];
}

/**
 * Trabalho como produto do orçamento, ou null quando não dá (sem custo ou sem preço gravado, como no "Virar produto";
 * ou já é produto: aí ele aparece pelo produto, sem duplicar). `filamentAlreadyTaken`: a 3D já baixou o filamento ao
 * salvar o trabalho, então ele sai da receita (não baixa duas vezes).
 */
export function jobAsQuoteProduct(
  kind: JobKind,
  job: ConvertibleJob,
  storeId: string,
  filamentAlreadyTaken = false,
): Product | null {
  if (job.productId) return null;
  if (jobProductBlock(kind, job, true)) return null;
  const base = productFromJob(kind, job, { storeId, name: job.name, now: '' });
  const skip = kind === 'print3d' && filamentAlreadyTaken ? new Set(jobFilamentIds(job)) : null;
  const materials = (base.materials ?? []).filter(m => !skip?.has(m.materialId));
  return {
    ...base,
    id: jobItemId(kind, job.id),
    name: `${job.name} (trabalho ${JOB_KIND_LABEL[kind]})`,
    category: 'Trabalhos das calculadoras',
    materials,
  } as Product;
}

/** O que o item do orçamento grava de um trabalho: a receita por peça (para reservar e baixar ao aprovar). */
export function jobItemFields(productId: string, products: Product[]): { jobRecipe?: ProductMaterial[] } {
  if (!isJobItemId(productId)) return {};
  const p = products.find(x => x.id === productId);
  return { jobRecipe: (p?.materials ?? []).map(m => ({ materialId: m.materialId, quantity: m.quantity })) };
}
