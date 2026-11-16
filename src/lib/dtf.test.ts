// DTF terceirizado (Estacionamento item 30, parte B3).
import { describe, expect, it } from 'vitest';
import type { CostBase, Material, Product, ProductGrade } from '../types';
import { calcQuoteItem } from './pricingEngine';
import { gradeKey } from './grade';
import { DEFAULT_DTF_TABLE as table, dtfBilledMeters, dtfFileCost, dtfPieceCost, dtfTableOf } from './dtf';

describe('Item 30 B3: metragem e faixas', () => {
  it('arredonda para cima: meio metro ou metro inteiro', () => {
    expect([0, 0.3, 0.5, 0.7, 1, 1.2, 5.5, 6].map(dtfBilledMeters)).toEqual([0, 0.5, 0.5, 1, 1, 2, 6, 6]);
  });
  it('tabela do fornecedor: cada faixa no limite', () => {
    expect(dtfFileCost(table, 0.5)).toBe(30);
    expect(dtfFileCost(table, 1)).toBe(60);
    expect(dtfFileCost(table, 5)).toBe(300);
    expect(dtfFileCost(table, 6)).toBe(300);
    expect(dtfFileCost(table, 50)).toBe(2500);
    expect(dtfFileCost(table, 51)).toBe(2295);
    expect(dtfFileCost(table, 100)).toBe(4500);
    expect(dtfFileCost(table, 101)).toBe(3838);
  });
  it('metragem quebrada usa a faixa da medida arredondada (5,5 m = 6 m a R$ 50)', () => {
    expect(dtfFileCost(table, 5.5)).toBe(300);
    expect(dtfFileCost(table, 0.7)).toBe(60);
  });
  it('por peça: arquivo ÷ estampas × estampas na peça', () => {
    expect(dtfPieceCost(table, { meters: 2, prints: 40 })).toBe(3);
    expect(dtfPieceCost(table, { meters: 2, prints: 40, printsPerPiece: 2 })).toBe(6);
  });
  it('sem metragem ou sem estampas: não há conta', () => {
    expect(dtfPieceCost(table, { meters: 2, prints: 0 })).toBeNull();
    expect(dtfPieceCost(table, { meters: 0, prints: 10 })).toBeNull();
    expect(dtfPieceCost(table, {})).toBeNull();
  });
  it('a tabela salva da loja vale sobre a padrão', () => {
    const own = { halfMeter: 35, tiers: [{ minMeters: 1, pricePerMeter: 70 }] };
    expect(dtfTableOf({ dtfTable: own })).toBe(own);
    expect(dtfTableOf(null)).toBe(table);
    expect(dtfTableOf({ dtfTable: { halfMeter: 1, tiers: [] } })).toBe(table);
  });
});

describe('Item 30 B3: no orçamento', () => {
  const grade: ProductGrade = {
    fabrics: ['Algodão'],
    sizes: ['P'],
    colors: ['Rosa'],
    costs: { 'Algodão|P': 20 },
    pieces: [],
    techniques: [
      { id: 'dtf', name: 'DTF', materials: [], minutes: 0, additionalValue: 0, fabrics: ['Algodão'], perMeter: true },
      { id: 'sil', name: 'Silk', materials: [], minutes: 0, additionalValue: 0, fabrics: ['Algodão'] },
    ],
  };
  const product = { id: 'c', name: 'Camiseta', materials: [], productionTime: 0, packagingCost: 0, grade };
  const costs = { hourlyRate: 0, markupPct: 100, storeId: 's' } as unknown as CostBase;
  const item = (technique: string, extra = {}) =>
    calcQuoteItem(
      {
        quantity: 1,
        selectedFinishingIds: [],
        selectedAccessoryIds: [],
        variationOptionId: gradeKey('Algodão', 'P', 'Rosa', technique),
        ...extra,
      },
      product as unknown as Product,
      [] as Material[],
      costs,
      0,
    )!;

  it('sem metragem e estampas o item não entra', () => {
    expect(item('dtf').variationMissing).toBe(true);
    expect(item('dtf', { dtfMeters: 2 }).variationMissing).toBe(true);
  });
  it('custo soma à peça e leva o markup: (20 + 3) × 2 = R$ 46', () => {
    const r = item('dtf', { dtfMeters: 2, dtfPrints: 40, dtfPrintsPerPiece: 1 });
    expect(r.variationMissing).toBe(false);
    expect(r.materialCost).toBe(23);
    expect(r.productionCost).toBe(23);
    expect(r.unitPrice).toBeCloseTo(46, 10);
  });
  it('frente e costas dobra o custo do DTF', () => {
    expect(item('dtf', { dtfMeters: 2, dtfPrints: 40, dtfPrintsPerPiece: 2 }).productionCost).toBe(26);
  });
  it('o item grava a conta: a tabela mudar depois não muda a venda', () => {
    expect(item('dtf', { dtfMeters: 2, dtfPrints: 40 }).variationFields).toMatchObject({
      dtfMeters: 2,
      dtfPrints: 40,
      dtfPrintsPerPiece: 1,
      dtfCostUnit: 3,
    });
  });
  it('outra técnica ignora os campos do DTF', () => {
    const r = item('sil', { dtfMeters: 2, dtfPrints: 40 });
    expect(r.productionCost).toBe(20);
    expect(r.variationFields.dtfCostUnit).toBeUndefined();
    expect(r.variationMissing).toBe(false);
  });
});
