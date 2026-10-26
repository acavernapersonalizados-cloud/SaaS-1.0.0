/**
 * jobProduct.ts — trabalho salvo de calculadora vira Produto (Etapa 8C, item 4).
 * Travas aprovadas em 26/10/2026: nada é criado sem confirmação; o trabalho guarda o id do produto (sem duplicados);
 * o produto nasce oculto no catálogo; o preço é o que valia na calculadora ao salvar (nada é recalculado);
 * trabalho sem máquina cadastrada ou com custo zero não vira produto.
 */
import type { JobKind, JobProductFields, Product, ProductMaterial } from '../types';
import { laserTotalTimeMin } from './calculators';

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

/**
 * Preço sugerido que a calculadora mostrava ao salvar (o sugerido do produto). Trabalhos salvos antes de 26/10/2026
 * em Laser, Papelaria e Cestas não o têm: vale o preço gravado no trabalho.
 */
export function jobSuggestedPrice(job: ConvertibleJob): number {
  const s = Number(job.suggestedUnit ?? job.suggestedPrice) || 0;
  return s > 0 ? s : jobUnitPrice(job);
}

const num = (v: unknown) => Number(v) || 0;
const round2 = (v: number) => Math.round(v * 100) / 100;

/** Materiais do estoque somados por id (o mesmo item pode aparecer mais de uma vez). */
function stockMaterials(entries: Array<{ materialId?: unknown; quantity: number }>): ProductMaterial[] {
  const byId = new Map<string, number>();
  for (const e of entries) {
    const id = typeof e.materialId === 'string' ? e.materialId : '';
    if (id && e.quantity > 0) byId.set(id, (byId.get(id) ?? 0) + e.quantity);
  }
  return [...byId].map(([materialId, quantity]) => ({ materialId, quantity }));
}

/**
 * Tempo de produção (min), embalagem (R$) e materiais do estoque POR UNIDADE, tirados do trabalho, para o produto
 * (só informação e baixa de estoque: o custo continua o do trabalho). materialUnit dá a unidade de um material do
 * estoque, para converter os gramas do filamento da Impressão 3D.
 */
export function jobProductDetails(
  kind: JobKind,
  job: ConvertibleJob,
  materialUnit: (materialId: string) => string | undefined = () => undefined,
): Pick<Product, 'productionTime' | 'packagingCost' | 'materials'> {
  const j = job as unknown as Record<string, unknown>;
  const qty = Math.max(num(j.quantity), 1);
  const list = (v: unknown) => (Array.isArray(v) ? (v as Array<Record<string, unknown>>) : []);
  switch (kind) {
    case 'laser':
      // Material digitado em R$, sem vínculo com o estoque (ver Estacionamento).
      return {
        productionTime: round2(laserTotalTimeMin(num(j.cuttingTimeMin), num(j.engravingTimeMin), num(j.passes) || 1)),
        packagingCost: 0,
        materials: [],
      };
    case 'papelaria':
      return {
        productionTime: round2((num(j.assemblyTimeMin) + num(j.finishingTimeMin) + num(j.packagingTimeMin)) / qty),
        packagingCost: 0,
        materials: stockMaterials(
          list(j.materials).map(m => ({ materialId: m.materialId, quantity: num(m.quantity) / qty })),
        ),
      };
    case 'cestas':
      return {
        productionTime: round2(num(j.assemblyTimeMin) / qty),
        packagingCost: round2((num(j.packagingCost) + num(j.ribbonCost) + num(j.tagCost)) / qty),
        materials: stockMaterials(
          list(j.items).map(i => ({ materialId: i.materialId, quantity: num(i.quantity) / qty })),
        ),
      };
    case 'print3d': {
      const id = typeof j.materialId === 'string' ? j.materialId : '';
      const unit = id ? (materialUnit(id) || '').toLowerCase() : '';
      const grams = num(j.filamentUsedG);
      const quantity = unit === 'kg' ? grams / 1000 : unit === 'g' ? grams : 0;
      return {
        productionTime: round2(num(j.postProcessHours) * 60),
        packagingCost: num(j.packagingCost),
        materials: stockMaterials([{ materialId: id, quantity }]),
      };
    }
    case 'sublimacao':
      return {
        productionTime: round2(num(j.laborMinPerPiece)),
        packagingCost: num(j.packagingCost),
        materials:
          j.baseMode === 'stock' ? stockMaterials([{ materialId: j.baseMaterialId, quantity: num(j.baseQty) }]) : [],
      };
  }
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
  opts: {
    storeId: string;
    name: string;
    categoryId?: string;
    categoryName?: string;
    now: string;
    materialUnit?: (materialId: string) => string | undefined;
  },
): Omit<Product, 'id'> & { createdAt: string; updatedAt: string } {
  const price = jobUnitPrice(job);
  return {
    storeId: opts.storeId,
    name: opts.name.trim() || job.name,
    category: opts.categoryName || '',
    categoryIds: opts.categoryId ? [opts.categoryId] : [],
    // Tempo, embalagem e materiais do trabalho: informação e baixa de estoque (o custo é o do trabalho).
    ...jobProductDetails(kind, job, opts.materialUnit),
    finishingOptions: [],
    accessories: [],
    jobCostUnit: jobUnitCost(job),
    jobSuggestedUnit: jobSuggestedPrice(job),
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

/**
 * Campos do produto que "Atualizar preço do produto" troca: custo, sugerido e preço gravados no trabalho, e o tempo,
 * a embalagem e os materiais do trabalho (corrige produtos criados antes de 26/10/2026).
 */
export function productPriceUpdate(
  kind: JobKind,
  job: ConvertibleJob,
  now: string,
  materialUnit?: (materialId: string) => string | undefined,
) {
  const price = jobUnitPrice(job);
  return {
    ...jobProductDetails(kind, job, materialUnit),
    jobCostUnit: jobUnitCost(job),
    jobSuggestedUnit: jobSuggestedPrice(job),
    manualPrice: price,
    catalogPrice: price,
    updatedAt: now,
  };
}
