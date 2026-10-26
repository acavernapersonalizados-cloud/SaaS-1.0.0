// Etapa 8C, item 4 — trabalho salvo vira Produto: preço do momento, travas e custo do produto.
import { describe, expect, it } from 'vitest';
import type { CostBase, Product } from '../types';
import { calcProductCost, calcProductPricing } from './pricingEngine';
import {
  jobProductBlock,
  jobUnitCost,
  jobUnitPrice,
  NO_SAVED_COST_MESSAGE,
  productFromJob,
  productPriceUpdate,
} from './jobProduct';

const job = { id: 'j1', name: 'TESTE Chaveiro', totalCostUnit: 7.5, unitPrice: 18.75, manualPrice: null };

describe('Preço do momento (sem recalcular)', () => {
  it('usa o preço gravado ao salvar; nos trabalhos sem ele, o manual e depois o sugerido gravado', () => {
    expect(jobUnitPrice(job)).toBe(18.75);
    expect(jobUnitPrice({ id: 'a', name: 'a', manualPrice: 40, suggestedUnit: 43.26 })).toBe(40);
    expect(jobUnitPrice({ id: 'b', name: 'b', manualPrice: null, suggestedUnit: 43.26 })).toBe(43.26);
    expect(jobUnitPrice({ id: 'c', name: 'c', suggestedPrice: 22.5 })).toBe(22.5); // Impressão 3D
    expect(jobUnitCost(job)).toBe(7.5);
  });
});

describe('Travas', () => {
  it('trabalho antigo de Laser, Papelaria e Cestas sem custo gravado: "abra e salve"', () => {
    const old = { id: 'o', name: 'o', manualPrice: 20 };
    for (const kind of ['laser', 'papelaria', 'cestas'] as const) {
      expect(jobProductBlock(kind, old, true)).toBe(NO_SAVED_COST_MESSAGE);
    }
    expect(NO_SAVED_COST_MESSAGE).toBe('Abra e salve este trabalho para gravar o custo atual');
  });
  it('máquina não cadastrada (Laser, 3D, Sublimação) bloqueia; Papelaria e Cestas não têm máquina', () => {
    for (const kind of ['laser', 'print3d', 'sublimacao'] as const) {
      expect(jobProductBlock(kind, job, false)).toBe('A máquina deste trabalho não está mais cadastrada.');
    }
    expect(jobProductBlock('papelaria', job, false)).toBeNull();
    expect(jobProductBlock('cestas', job, false)).toBeNull();
  });
  it('custo zero ou sem preço bloqueia; com custo e preço, pode', () => {
    expect(jobProductBlock('laser', { ...job, totalCostUnit: 0 }, true)).toBe(
      'Custo zero: confira o trabalho na calculadora.',
    );
    expect(jobProductBlock('laser', { ...job, unitPrice: 0 }, true)).toBe(
      'Sem preço: confira o trabalho na calculadora.',
    );
    expect(jobProductBlock('laser', job, true)).toBeNull();
  });
});

describe('Produto criado a partir do trabalho', () => {
  const p = productFromJob('laser', job, {
    storeId: 'loja',
    name: '  Chaveiro MDF  ',
    categoryId: 'cat-1',
    categoryName: 'Presentes',
    now: '2026-10-26T12:00:00.000Z',
  });
  it('nasce oculto no catálogo, com o preço e o custo do trabalho e o vínculo com ele', () => {
    expect(p).toMatchObject({
      name: 'Chaveiro MDF',
      category: 'Presentes',
      categoryIds: ['cat-1'],
      showInCatalog: false,
      manualPrice: 18.75,
      catalogPrice: 18.75,
      jobCostUnit: 7.5,
      sourceJob: { kind: 'laser', id: 'j1' },
      materials: [],
      productionTime: 0,
      packagingCost: 0,
    });
  });
  it('na tela Produtos: custo = custo do trabalho e preço efetivo = preço da calculadora', () => {
    const costs = { storeId: 'loja', fixedCosts: 0, productiveHours: 0, profitGoal: 0, markupPct: 100, hourlyRate: 20 };
    const product = { ...p, id: 'novo' } as Product;
    expect(calcProductCost(product, [], costs as CostBase)).toMatchObject({ jobCost: 7.5, totalCost: 7.5 });
    expect(calcProductPricing(product, [], costs as CostBase).effectivePrice).toBe(18.75);
  });
  it('produto sem custo de trabalho (todos os de antes): a conta não muda', () => {
    const old = { materials: [], productionTime: 30, packagingCost: 1 } as Partial<Product>;
    const costs = { hourlyRate: 20 } as CostBase;
    expect(calcProductCost(old, [], costs)).toEqual({
      materialCost: 0,
      laborCost: 10,
      packagingCost: 1,
      jobCost: 0,
      totalCost: 11,
    });
  });
  it('"Atualizar preço do produto" troca só o custo e o preço gravados no trabalho', () => {
    expect(productPriceUpdate({ ...job, unitPrice: 20, totalCostUnit: 8 }, 'agora')).toEqual({
      jobCostUnit: 8,
      manualPrice: 20,
      catalogPrice: 20,
      updatedAt: 'agora',
    });
  });
});
