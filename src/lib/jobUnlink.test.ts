// Correção de 14/11/2026: produto da calculadora vira produto normal.
import { describe, expect, it } from 'vitest';
import type { CostBase, Material, Product } from '../types';
import { calcProductCost, calcProductPricing } from './pricingEngine';
import { unlinkProductFromJob } from './jobProduct';

const materials = [{ id: 'camiseta', unitCost: 12 }] as unknown as Material[];
const costs = { hourlyRate: 60, markupPct: 100, storeId: 's' } as unknown as CostBase;
const job: Partial<Product> = {
  name: 'Camiseta',
  materials: [{ materialId: 'camiseta', quantity: 2 }],
  productionTime: 10,
  packagingCost: 1,
  jobCostUnit: 40,
  jobSuggestedUnit: 80,
  sourceJob: { kind: 'sublimacao', id: 't1' },
  manualPrice: 70,
};

describe('Correção de 14/11: editar como produto normal', () => {
  it('tira o custo fixo e o vínculo; mantém materiais, tempo, embalagem e preço manual', () => {
    const next = unlinkProductFromJob(job);
    expect(next).toEqual({ ...job, jobCostUnit: 0, jobSuggestedUnit: 0, sourceJob: null });
    expect(job.jobCostUnit).toBe(40);
  });
  it('o custo passa a vir dos materiais, do tempo e da embalagem', () => {
    expect(calcProductCost(job, materials, costs).totalCost).toBe(40);
    expect(calcProductCost(unlinkProductFromJob(job), materials, costs).totalCost).toBe(35);
  });
  it('o preço manual continua valendo; sem ele, o sugerido segue o custo novo', () => {
    expect(calcProductPricing(unlinkProductFromJob(job), materials, costs).effectivePrice).toBe(70);
    const noManual = unlinkProductFromJob({ ...job, manualPrice: null });
    expect(calcProductPricing(noManual, materials, costs).suggestedPrice).toBeCloseTo(70, 10);
  });
});
