// Motor de preços — valores do CHECKLIST-TESTES.md (seções 5, 8, 10 e 16).
import { describe, expect, it } from 'vitest';
import type { CostBase, Material, Product } from '../types';
import {
  calcCatalogKPIs,
  calcProductPricing,
  calcQuoteItem,
  calcReversePrice,
  clampMargin,
  clampMarkup,
  energyCost,
  getProfitStatus,
  laborCostFromHours,
  laborCostFromMinutes,
  marginToMarkup,
  markupOf,
  priceForMargin,
  priceForMarkup,
  realMargin,
  wearCost,
} from './pricingEngine';
import { isLowStock, packageSize } from './utils';

// Seção 5: R$ 3.200 / 160 h → R$ 20/h; Meta de Lucro 50% (margem sobre o preço).
const costs: CostBase = { storeId: 'loja', fixedCosts: 3200, productiveHours: 160, profitGoal: 50, hourlyRate: 20 };

// Seção 7: TESTE MDF 3mm (R$ 60 / 4 un = R$ 15) e TESTE Argola (pacote de 100 por R$ 25 = R$ 0,25).
const materials = [
  { id: 'mdf', unitCost: 15 },
  { id: 'argola', unitCost: 0.25 },
] as Material[];

// Seção 8: TESTE Chaveiro.
const chaveiro = {
  id: 'chaveiro',
  name: 'TESTE Chaveiro',
  productionTime: 15,
  packagingCost: 0.75,
  materials: [
    { materialId: 'mdf', quantity: 0.1 },
    { materialId: 'argola', quantity: 1 },
  ],
  finishingOptions: [{ id: 'verniz', name: 'Verniz', additionalValue: 2 }],
  accessories: [{ id: 'caixinha', name: 'Caixinha', additionalValue: 3 }],
} as unknown as Product;

describe('Markup sobre o custo (Etapa 7)', () => {
  it('preço = (custo + taxas fixas) × (1 + markup) ÷ (1 − taxas %)', () => {
    expect(priceForMarkup(10, 150)).toBeCloseTo(25, 10);
    expect(priceForMarkup(21.39, 150, 18)).toBeCloseTo(65.2134, 4); // Caderno A5, Mercado Livre
    expect(priceForMarkup(21.39, 150, 20, 4)).toBeCloseTo(79.34375, 6); // Caderno A5, Shopee (opção A)
  });
  it('markup 0 → preço = custo; taxas ≥ 95% não têm preço possível', () => {
    expect(priceForMarkup(10, 0)).toBe(10);
    expect(priceForMarkup(10, 100, 95)).toBeNull();
    expect(priceForMarkup(10, -1)).toBeNull();
  });
  it('lucro em R$ = (custo + taxa fixa) × markup: igual em todo canal sem taxa fixa', () => {
    for (const [fee, fixed] of [
      [0, 0],
      [18, 0],
      [26.5, 0],
      [20, 4],
    ] as const) {
      const price = priceForMarkup(21.39, 150, fee, fixed)!;
      const lucro = price * (1 - fee / 100) - fixed - 21.39;
      expect(lucro).toBeCloseTo((21.39 + fixed) * 1.5, 6);
    }
  });
  it('margem real depois das taxas', () => {
    expect(realMargin(25, 10)).toBeCloseTo(60, 10);
    expect(realMargin(priceForMarkup(21.39, 150, 18)!, 21.39, 18)).toBeCloseTo(49.2, 1);
    expect(realMargin(0, 10)).toBe(0);
  });
  it('conversão da meta gravada: margem ÷ (1 − margem); a partir de 95% já era markup', () => {
    expect(marginToMarkup(60)).toBeCloseTo(150, 10);
    expect(marginToMarkup(50)).toBeCloseTo(100, 10);
    expect(marginToMarkup(0)).toBe(0);
    expect(marginToMarkup(100)).toBe(100); // T&N: 100% gravado antes de 17/10 = dobrar o custo
  });
  it('markupOf: usa o markup gravado; sem ele, converte a meta antiga', () => {
    expect(markupOf({ ...costs, markupPct: 80 })).toBe(80);
    expect(markupOf({ ...costs, profitGoal: 60 })).toBeCloseTo(150, 10);
    expect(markupOf({ ...costs, profitGoal: 100 })).toBe(100);
    expect(markupOf(null)).toBe(0);
  });
  it('clampMarkup limita os campos entre 0 e 500', () => {
    expect(clampMarkup(600)).toBe(500);
    expect(clampMarkup(-5)).toBe(0);
    expect(clampMarkup(150)).toBe(150);
  });
});

describe('priceForMargin (margem sobre o preço)', () => {
  it('preço = custo ÷ (1 − margem − taxa)', () => {
    expect(priceForMargin(7.5, 50)).toBeCloseTo(15, 10);
    expect(priceForMargin(7.5, 50, 20)).toBeCloseTo(25, 10);
    expect(priceForMargin(14.306, 60, 14, 4)).toBeCloseTo(70.4077, 4);
  });
  it('meta 0 → preço = custo', () => {
    expect(priceForMargin(10, 0)).toBe(10);
  });
  it('margem + taxa ≥ 95% não tem preço possível', () => {
    expect(priceForMargin(10, 80, 20)).toBeNull();
    expect(priceForMargin(10, 95)).toBeNull();
    expect(priceForMargin(10, 94)).not.toBeNull();
  });
  it('clampMargin limita os campos entre 0 e 90', () => {
    expect(clampMargin(150)).toBe(90);
    expect(clampMargin(-5)).toBe(0);
    expect(clampMargin(42)).toBe(42);
  });
});

describe('Custos de produção (energia, desgaste, mão de obra)', () => {
  it('energia: (W ÷ 1000) × horas × tarifa — laser 60 W por 0,5 h (12.2) e 3D 200 W por 2 h (13.1)', () => {
    expect(energyCost(60, 0.5, 0.78938)).toBeCloseTo(0.0236814, 7);
    expect(energyCost(200, 2, 0.85)).toBeCloseTo(0.34, 10);
  });
  it('desgaste: (reposição ÷ vida útil) × horas; vida útil 0 → 0', () => {
    expect(wearCost(400, 10000, 0.5)).toBeCloseTo(0.02, 10);
    expect(wearCost(80, 500, 2)).toBeCloseTo(0.32, 10);
    expect(wearCost(80, 0, 2)).toBe(0);
  });
  it('mão de obra: por minutos (R$ 25/h × 30 min) e por horas (R$ 12/h × 0,5 h)', () => {
    expect(laborCostFromMinutes(25, 30)).toBeCloseTo(12.5, 10);
    expect(laborCostFromHours(12, 0.5)).toBe(6);
  });
});

describe('Produto (seção 8)', () => {
  it('8.1 sem preço manual: custo R$ 7,50, sugerido R$ 15,00, margem 50%, Bom', () => {
    const p = calcProductPricing(chaveiro, materials, costs);
    expect(p.materialCost).toBeCloseTo(1.75, 10);
    expect(p.laborCost).toBeCloseTo(5, 10);
    expect(p.packagingCost).toBe(0.75);
    expect(p.totalCost).toBeCloseTo(7.5, 10);
    expect(p.suggestedPrice).toBeCloseTo(15, 10);
    expect(p.margin).toBeCloseTo(50, 10);
    expect(p.profitStatus.label).toBe('Bom');
  });
  it('8.2 preço manual 12: lucro R$ 4,50, margem 37,5%, Bom', () => {
    const p = calcProductPricing({ ...chaveiro, manualPrice: 12 }, materials, costs);
    expect(p.profitPerUnit).toBeCloseTo(4.5, 10);
    expect(p.margin).toBeCloseTo(37.5, 10);
    expect(p.profitStatus.label).toBe('Bom');
  });
  it('8.3 preço manual 7: prejuízo de R$ 0,50, margem −7,1%, recomenda R$ 7.50', () => {
    const p = calcProductPricing({ ...chaveiro, manualPrice: 7 }, materials, costs);
    expect(p.profitPerUnit).toBeCloseTo(-0.5, 10);
    expect(p.margin).toBeCloseTo(-7.14, 2);
    expect(p.profitStatus.label).toBe('Prejuízo');
    expect(p.profitStatus.recommendation).toContain('7.50');
  });
  it('8.4 precificação reversa a R$ 20: lucro R$ 12,50, margem 62,5%, markup 2,67x, Excelente', () => {
    const r = calcReversePrice(20, 7.5);
    expect(r.profit).toBeCloseTo(12.5, 10);
    expect(r.margin).toBeCloseTo(62.5, 10);
    expect(r.markup).toBeCloseTo(2.67, 2);
    expect(r.profitStatus.label).toBe('Excelente');
  });
  it('meta 0 vale 0 (não vira 30%)', () => {
    const p = calcProductPricing(chaveiro, materials, { ...costs, profitGoal: 0 });
    expect(p.suggestedPrice).toBeCloseTo(7.5, 10);
  });
  it('meta válida: invalidProfitGoal = false', () => {
    expect(calcProductPricing(chaveiro, materials, costs).invalidProfitGoal).toBe(false);
  });
  it('T&N: meta 100% gravada antes de 17/10 vira markup 100% → preço = 2 × custo', () => {
    const p = calcProductPricing(chaveiro, materials, { ...costs, profitGoal: 100 });
    expect(p.suggestedPrice).toBeCloseTo(15, 10);
    expect(p.invalidProfitGoal).toBe(false);
  });
  it('A Caverna: meta 60% vira markup 150% → mesmo preço de hoje (custo ÷ 0,4)', () => {
    expect(calcProductPricing(chaveiro, materials, { ...costs, profitGoal: 60 }).suggestedPrice).toBeCloseTo(18.75, 10);
  });
  it('markup gravado tem prioridade sobre a meta antiga', () => {
    expect(calcProductPricing(chaveiro, materials, { ...costs, markupPct: 200 }).suggestedPrice).toBeCloseTo(22.5, 10);
  });
  it('markup inválido (negativo): sugerido 0 e invalidProfitGoal = true', () => {
    const p = calcProductPricing(chaveiro, materials, { ...costs, markupPct: -10 });
    expect(p.suggestedPrice).toBe(0);
    expect(p.invalidProfitGoal).toBe(true);
  });
  it('produto sem custo não é "meta inválida"', () => {
    const semCusto = { ...chaveiro, materials: [], productionTime: 0, packagingCost: 0 };
    expect(calcProductPricing(semCusto, materials, { ...costs, markupPct: -10 }).invalidProfitGoal).toBe(false);
  });
  it('faixas de status: 55 Excelente, 35 Bom, 15 Margem Baixa, 0 Arriscado, <0 Prejuízo', () => {
    expect(getProfitStatus(55).label).toBe('Excelente');
    expect(getProfitStatus(54.9).label).toBe('Bom');
    expect(getProfitStatus(35).label).toBe('Bom');
    expect(getProfitStatus(15).label).toBe('Margem Baixa');
    expect(getProfitStatus(0).label).toBe('Arriscado');
    expect(getProfitStatus(-0.1).label).toBe('Prejuízo');
  });
  it('KPIs do catálogo contam o chaveiro como Bom', () => {
    const k = calcCatalogKPIs([chaveiro], materials, costs);
    expect(k.productsWithPrice).toBe(1);
    expect(k.productsGood).toBe(1);
    expect(k.avgMargin).toBeCloseTo(50, 10);
  });
});

describe('Orçamento (seção 10) — 10 chaveiros, markup 100% (meta 50% convertida)', () => {
  const item = (fee: number, extra: Record<string, unknown> = {}) =>
    calcQuoteItem({ quantity: 10, ...extra }, chaveiro, materials, costs, fee)!;

  it('10.1 Instagram/Venda Direta (0%): R$ 15,00 / R$ 150,00 / lucro R$ 75,00 / margem real 50%', () => {
    const r = item(0);
    expect(r.unitPrice).toBeCloseTo(15, 10);
    expect(r.totalPrice).toBeCloseTo(150, 10);
    expect(r.itemProfit).toBeCloseTo(75, 10);
    expect(r.markup).toBeCloseTo(100, 10);
    expect(r.margin).toBeCloseTo(50, 10);
  });
  it('10.2 Shopee (20%): R$ 18,75 / R$ 187,50 / mesmo lucro R$ 75,00 / margem real 40%', () => {
    const r = item(20);
    expect(r.unitPrice).toBeCloseTo(18.75, 10);
    expect(r.totalPrice).toBeCloseTo(187.5, 10);
    expect(r.itemProfit).toBeCloseTo(75, 10);
    expect(r.margin).toBeCloseTo(40, 10);
  });
  it('10.3 Mercado Livre (18%): R$ 18,29 / R$ 182,93 / mesmo lucro R$ 75,00 / margem real 41%', () => {
    const r = item(18);
    expect(r.unitPrice).toBeCloseTo(18.29, 2);
    expect(r.totalPrice).toBeCloseTo(182.93, 2);
    expect(r.itemProfit).toBeCloseTo(75, 10);
    expect(r.margin).toBeCloseTo(41, 10);
  });
  it('Atacado (5%): R$ 15,79', () => {
    expect(item(5).unitPrice).toBeCloseTo(15.79, 2);
  });
  it('10.4 Venda Direta + markup personalizado 40%: R$ 10,50 / R$ 105,00 / lucro R$ 30,00', () => {
    const r = item(0, { customMarkup: 40 });
    expect(r.unitPrice).toBeCloseTo(10.5, 10);
    expect(r.totalPrice).toBeCloseTo(105, 10);
    expect(r.itemProfit).toBeCloseTo(30, 10);
    expect(r.markup).toBe(40);
  });
  it('10.5 Shopee + Verniz (+R$ 2): R$ 20,75 / R$ 207,50 / lucro R$ 91,00', () => {
    const r = item(20, { selectedFinishingIds: ['verniz'] });
    expect(r.unitPrice).toBeCloseTo(20.75, 10);
    expect(r.totalPrice).toBeCloseTo(207.5, 10);
    expect(r.itemProfit).toBeCloseTo(91, 10);
    expect(r.finishingNames).toEqual(['Verniz']);
  });
  it('10.6 taxas do canal ≥ 95%: item inválido, preço 0', () => {
    const r = item(95);
    expect(r.invalidMargin).toBe(true);
    expect(r.unitPrice).toBe(0);
  });
  it('markup alto (500%) com taxa continua válido', () => {
    expect(item(20, { customMarkup: 500 }).invalidMargin).toBe(false);
  });
  it('8.5 produto em pacote de 10: preço por item = preço do pacote ÷ 10', () => {
    const r = calcQuoteItem(
      { quantity: 1 },
      { ...chaveiro, isPackage: true, packageQuantity: 10 },
      materials,
      costs,
      0,
    )!;
    expect(r.pricePerItem).toBeCloseTo(r.unitPrice / 10, 10);
  });
});

describe('Estoque (seção 16)', () => {
  it('estoque baixo só com mínimo > 0 e saldo ≤ mínimo', () => {
    expect(isLowStock({ stockQuantity: 2, minStockQuantity: 5 })).toBe(true);
    expect(isLowStock({ stockQuantity: 5, minStockQuantity: 5 })).toBe(true);
    expect(isLowStock({ stockQuantity: 6, minStockQuantity: 5 })).toBe(false);
    expect(isLowStock({ stockQuantity: 0, minStockQuantity: 0 })).toBe(false);
  });
  it('tamanho do pacote: pct ou isPackage usa packageQuantity, senão 1', () => {
    expect(packageSize({ unit: 'pct', packageQuantity: 100 })).toBe(100);
    expect(packageSize({ isPackage: true, unit: 'un', packageQuantity: 10 })).toBe(10);
    expect(packageSize({ unit: 'm', packageQuantity: 100 })).toBe(1);
    expect(packageSize(null)).toBe(1);
  });
});
