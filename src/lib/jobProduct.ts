/**
 * jobProduct.ts — trabalho salvo de calculadora vira Produto (Etapa 8C, item 4).
 * Travas aprovadas em 26/10/2026: nada é criado sem confirmação; o trabalho guarda o id do produto (sem duplicados);
 * o produto nasce oculto no catálogo; o preço é o que valia na calculadora ao salvar (nada é recalculado);
 * trabalho sem máquina cadastrada ou com custo zero não vira produto.
 */
import type { JobKind, JobProductFields, Product } from '../types';

/** Coleção de cada calculadora. */
export const JOB_COLLECTIONS: Record<JobKind, string> = {
  laser: 'laserJobs',
  print3d: 'printJobs',
  papelaria: 'papelariaJobs',
  cestas: 'cestaJobs',
  sublimacao: 'sublimationJobs',
};

/** Calculadoras que só passaram a gravar custo e preço no trabalho na Etapa 8C. */
const COST_SAVED_SINCE_8C: JobKind[] = ['laser', 'papelaria', 'cestas'];

/** Calculadoras com máquina (Laser, impressora 3D, prensa). */
export const JOB_KINDS_WITH_MACHINE: JobKind[] = ['laser', 'print3d', 'sublimacao'];

export const NO_SAVED_COST_MESSAGE = 'Abra e salve este trabalho para gravar o custo atual';

/** O que um trabalho salvo precisa ter para virar produto. */
export interface ConvertibleJob extends JobProductFields {
  id: string;
  name: string;
  manualPrice?: number | null;
  /** Preço sugerido gravado pela Sublimação. */
  suggestedUnit?: number;
  /** Preço sugerido gravado pela Impressão 3D. */
  suggestedPrice?: number;
}

/** Custo por unidade gravado no trabalho (0 quando não há). */
export const jobUnitCost = (job: ConvertibleJob) => Number(job.totalCostUnit) || 0;

/**
 * Preço por unidade que valia na calculadora ao salvar: o gravado (unitPrice) ou, nos trabalhos que não o têm,
 * o manual e, sem ele, o sugerido gravado. Nunca recalcula.
 */
export function jobUnitPrice(job: ConvertibleJob): number {
  if (Number(job.unitPrice) > 0) return Number(job.unitPrice);
  if (Number(job.manualPrice) > 0) return Number(job.manualPrice);
  return Number(job.suggestedUnit ?? job.suggestedPrice) || 0;
}

/** Motivo para o trabalho NÃO poder virar produto, ou null quando pode. */
export function jobProductBlock(kind: JobKind, job: ConvertibleJob, hasMachine: boolean): string | null {
  if (job.totalCostUnit === undefined || job.totalCostUnit === null) {
    return COST_SAVED_SINCE_8C.includes(kind) ? NO_SAVED_COST_MESSAGE : 'Este trabalho não tem custo gravado.';
  }
  if (JOB_KINDS_WITH_MACHINE.includes(kind) && !hasMachine) {
    return 'A máquina deste trabalho não está mais cadastrada.';
  }
  if (!(jobUnitCost(job) > 0)) return 'Custo zero: confira o trabalho na calculadora.';
  if (!(jobUnitPrice(job) > 0)) return 'Sem preço: confira o trabalho na calculadora.';
  return null;
}

/** Produto novo a partir do trabalho: custo e preço gravados, oculto no catálogo. */
export function productFromJob(
  kind: JobKind,
  job: ConvertibleJob,
  opts: { storeId: string; name: string; categoryId?: string; categoryName?: string; now: string },
): Omit<Product, 'id'> & { createdAt: string; updatedAt: string } {
  const price = jobUnitPrice(job);
  return {
    storeId: opts.storeId,
    name: opts.name.trim() || job.name,
    category: opts.categoryName || '',
    categoryIds: opts.categoryId ? [opts.categoryId] : [],
    materials: [],
    productionTime: 0,
    packagingCost: 0,
    finishingOptions: [],
    accessories: [],
    jobCostUnit: jobUnitCost(job),
    sourceJob: { kind, id: job.id },
    manualPrice: price,
    catalogPrice: price,
    // Trava 3: nasce oculto; só aparece quando marcar "mostrar no catálogo".
    showInCatalog: false,
    showPrice: true,
    createdAt: opts.now,
    updatedAt: opts.now,
  };
}

/** Campos do produto que "Atualizar preço do produto" troca: o custo e o preço gravados no trabalho. */
export function productPriceUpdate(job: ConvertibleJob, now: string) {
  const price = jobUnitPrice(job);
  return { jobCostUnit: jobUnitCost(job), manualPrice: price, catalogPrice: price, updatedAt: now };
}
