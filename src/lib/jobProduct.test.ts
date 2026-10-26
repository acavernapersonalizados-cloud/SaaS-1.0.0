// Etapa 8C, item 4 — trabalho salvo vira Produto: preço do momento, travas e custo do produto.
import { describe, expect, it } from 'vitest';
import type { CostBase, Product } from '../types';
import { calcProductCost, calcProductPricing } from './pricingEngine';
import {
  jobProductBlock,
  jobProductDetails,
  jobSuggestedPrice,
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

// Correção de 26/10/2026 — tempo, embalagem e materiais do estoque POR UNIDADE, tirados de cada calculadora.
describe('Tempo, embalagem e materiais vindos do trabalho', () => {
  const base = { id: 'j', name: 'j' };
  it('Laser: tempo de corte + gravação × passadas; material digitado não vincula ao estoque', () => {
    expect(jobProductDetails('laser', { ...base, cuttingTimeMin: 3, engravingTimeMin: 2, passes: 2 } as never)).toEqual(
      { productionTime: 10, packagingCost: 0, materials: [] },
    );
  });
  it('Papelaria: tempos ÷ lote; materiais do estoque ÷ lote, somados por item', () => {
    const job = {
      ...base,
      quantity: 10,
      assemblyTimeMin: 20,
      finishingTimeMin: 10,
      packagingTimeMin: 10,
      materials: [
        { materialId: 'papel', quantity: 20 },
        { materialId: null, quantity: 5 },
        { materialId: 'papel', quantity: 10 },
      ],
    };
    expect(jobProductDetails('papelaria', job as never)).toEqual({
      productionTime: 4,
      packagingCost: 0,
      materials: [{ materialId: 'papel', quantity: 3 }],
    });
  });
  it('Cestas: montagem e embalagem (embalagem + fitas + tag) ÷ lote; itens do estoque ÷ lote', () => {
    const job = {
      ...base,
      quantity: 2,
      assemblyTimeMin: 30,
      packagingCost: 4,
      ribbonCost: 2,
      tagCost: 1,
      items: [{ materialId: 'fita', quantity: 3 }, { quantity: 1 }],
    };
    expect(jobProductDetails('cestas', job as never)).toEqual({
      productionTime: 15,
      packagingCost: 3.5,
      materials: [{ materialId: 'fita', quantity: 1.5 }],
    });
  });
  it('Impressão 3D: pós-processo em minutos; filamento convertido para a unidade do estoque', () => {
    const job = { ...base, materialId: 'pla', filamentUsedG: 120, postProcessHours: 0.5, packagingCost: 1 };
    expect(jobProductDetails('print3d', job as never, () => 'kg')).toEqual({
      productionTime: 30,
      packagingCost: 1,
      materials: [{ materialId: 'pla', quantity: 0.12 }],
    });
    expect(jobProductDetails('print3d', job as never, () => 'g').materials).toEqual([
      { materialId: 'pla', quantity: 120 },
    ]);
    expect(jobProductDetails('print3d', job as never, () => 'm').materials).toEqual([]);
  });
  it('Sublimação: mão de obra por peça, embalagem e a peça base do estoque', () => {
    const job = {
      ...base,
      laborMinPerPiece: 30,
      packagingCost: 2.5,
      baseMode: 'stock',
      baseMaterialId: 'caneca',
      baseQty: 1,
    };
    expect(jobProductDetails('sublimacao', job as never)).toEqual({
      productionTime: 30,
      packagingCost: 2.5,
      materials: [{ materialId: 'caneca', quantity: 1 }],
    });
    expect(jobProductDetails('sublimacao', { ...job, baseMode: 'manual' } as never).materials).toEqual([]);
  });
  it('sugerido da calculadora: o gravado no trabalho; sem ele, o preço do trabalho', () => {
    expect(jobSuggestedPrice({ ...base, suggestedUnit: 43.26, unitPrice: 40 })).toBe(43.26);
    expect(jobSuggestedPrice({ ...base, suggestedPrice: 22.5 })).toBe(22.5);
    expect(jobSuggestedPrice({ ...base, unitPrice: 40 })).toBe(40);
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
  // Correção de 26/10/2026 — caso real (Caneca Mágica, Sublimação): custo R$ 29,47 e sugerido R$ 58,93 na calculadora.
  it('caso real: tempo e embalagem preenchidos NÃO somam de novo; custo e sugerido iguais aos da calculadora', () => {
    const caneca = {
      id: 'caneca',
      jobCostUnit: 29.46611388888889,
      jobSuggestedUnit: 58.93222777777778,
      productionTime: 30,
      packagingCost: 2.5,
      materials: [{ materialId: 'caneca-base', quantity: 1 }],
    } as unknown as Product;
    const costs = { hourlyRate: 15.384615384615385, markupPct: 150 } as CostBase; // markup da loja diferente
    const materials = [{ id: 'caneca-base', unitCost: 19.2 }] as never;
    expect(calcProductCost(caneca, materials, costs).totalCost).toBeCloseTo(29.46611388888889, 10);
    const pricing = calcProductPricing(caneca, materials, costs);
    expect(pricing.totalCost).toBeCloseTo(29.46611388888889, 10);
    expect(pricing.suggestedPrice).toBeCloseTo(58.93222777777778, 10);
    expect(pricing.effectivePrice).toBeCloseTo(58.93222777777778, 10);
  });
  it('"Atualizar preço do produto" troca só o custo e o preço gravados no trabalho', () => {
    expect(productPriceUpdate('papelaria', { ...job, unitPrice: 20, totalCostUnit: 8 }, 'agora')).toEqual({
      productionTime: 0,
      packagingCost: 0,
      materials: [],
      jobCostUnit: 8,
      jobSuggestedUnit: 20,
      manualPrice: 20,
      catalogPrice: 20,
      updatedAt: 'agora',
    });
  });
});
