// Etapa 8C, item 3a — desconto de atacado por faixa de quantidade, com piso de custo × 1,30 + taxas.
import { describe, expect, it } from 'vitest';
import type { Material, Product } from '../types';
import { calcQuoteItem } from './pricingEngine';
import {
  applyWholesale,
  DEFAULT_WHOLESALE_TIERS,
  wholesaleDiscountFor,
  wholesaleTierLabel,
  wholesaleTiersOf,
} from './wholesale';

describe('Faixas de atacado', () => {
  it('padrão aprovado em 25/10/2026: 10–29 = 10%, 30–99 = 20%, 100+ = 30%', () => {
    expect(DEFAULT_WHOLESALE_TIERS).toEqual([
      { minQty: 10, discountPct: 10 },
      { minQty: 30, discountPct: 20 },
      { minQty: 100, discountPct: 30 },
    ]);
    expect([0, 1, 2].map(i => wholesaleTierLabel(DEFAULT_WHOLESALE_TIERS, i))).toEqual([
      '10–29 un',
      '30–99 un',
      '100+ un',
    ]);
  });
  it('desconto pela quantidade do item, nos limites de cada faixa', () => {
    const d = (q: number) => wholesaleDiscountFor(DEFAULT_WHOLESALE_TIERS, q);
    expect([1, 9, 10, 29, 30, 99, 100, 500].map(d)).toEqual([0, 0, 10, 10, 20, 20, 30, 30]);
  });
  it('loja sem faixas gravadas usa a padrão; com faixas, usa as dela em ordem e dentro dos limites', () => {
    expect(wholesaleTiersOf(null)).toEqual(DEFAULT_WHOLESALE_TIERS);
    expect(wholesaleTiersOf({ wholesaleTiers: [] })).toEqual(DEFAULT_WHOLESALE_TIERS);
    expect(
      wholesaleTiersOf({
        wholesaleTiers: [
          { minQty: 50, discountPct: 150 },
          { minQty: 20, discountPct: -5 },
          { minQty: 1, discountPct: 10 },
        ],
      }),
    ).toEqual([
      { minQty: 20, discountPct: 0 },
      { minQty: 50, discountPct: 90 },
    ]);
  });
});

describe('Desconto com piso (applyWholesale)', () => {
  it('abaixo de 10 unidades não muda o preço', () => {
    const r = applyWholesale(20, 8, 9, DEFAULT_WHOLESALE_TIERS);
    expect(r.price).toBe(20);
    expect(r.discountPct).toBe(0);
    expect(r.floorPrice).toBeCloseTo(10.4, 10);
    expect(r.floorApplied).toBe(false);
  });
  it('desconto da faixa quando fica acima do piso', () => {
    const r = applyWholesale(20, 8, 100, DEFAULT_WHOLESALE_TIERS); // 20 × 0,7 = 14 > 8 × 1,3
    expect(r.price).toBeCloseTo(14, 10);
    expect(r.discountPct).toBe(30);
    expect(r.floorApplied).toBe(false);
  });
  it('desconto que passa do piso: usa o piso (custo × 1,30) e avisa', () => {
    const r = applyWholesale(15, 10, 100, DEFAULT_WHOLESALE_TIERS); // 10,50 < 13,00
    expect(r.price).toBeCloseTo(13, 10);
    expect(r.floorApplied).toBe(true);
  });
  it('o piso inclui as taxas do canal (Shopee: 20% + R$ 4,00) e nunca passa do varejo', () => {
    const r = applyWholesale(20, 10, 100, DEFAULT_WHOLESALE_TIERS, 20, 4); // piso (10 + 4) × 1,3 ÷ 0,8
    expect(r.floorPrice).toBeCloseTo(22.75, 10);
    expect(r.price).toBeCloseTo(20, 10);
    expect(r.floorApplied).toBe(true);
  });
});

describe('Orçamento com atacado (calcQuoteItem)', () => {
  const costs = { storeId: 'loja', fixedCosts: 0, productiveHours: 0, profitGoal: 0, markupPct: 150, hourlyRate: 20 };
  const materials = [
    { id: 'mdf', unitCost: 15 },
    { id: 'argola', unitCost: 0.25 },
  ] as Material[];
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
  } as unknown as Product;
  const quote = (quantity: number, fee = 0, fixed = 0, extra = {}) =>
    calcQuoteItem({ quantity, ...extra }, chaveiro, materials, costs, fee, fixed, DEFAULT_WHOLESALE_TIERS)!;

  it('9 unidades: preço de varejo (custo R$ 7,50 × 2,5 = R$ 18,75)', () => {
    const r = quote(9);
    expect(r.unitPrice).toBeCloseTo(18.75, 10);
    expect(r.wholesaleDiscountPct).toBe(0);
  });
  it('30 unidades: 20% de desconto sobre o varejo, lucro recalculado', () => {
    const r = quote(30);
    expect(r.retailBasePrice).toBeCloseTo(18.75, 10);
    expect(r.unitPrice).toBeCloseTo(15, 10);
    expect(r.totalPrice).toBeCloseTo(450, 10);
    expect(r.itemProfit).toBeCloseTo(450 - 7.5 * 30, 10);
    expect(r.wholesaleDiscountPct).toBe(20);
    expect(r.wholesaleFloorApplied).toBe(false);
  });
  it('acabamento não tem desconto', () => {
    const r = quote(100, 0, 0, { selectedFinishingIds: ['verniz'] });
    expect(r.unitPrice).toBeCloseTo(18.75 * 0.7 + 2, 10);
  });
  it('markup personalizado baixo: o desconto para no piso de custo × 1,30', () => {
    const r = quote(100, 0, 0, { customMarkup: 50 }); // varejo 11,25; 30% = 7,875 < 9,75
    expect(r.unitPrice).toBeCloseTo(9.75, 10);
    expect(r.wholesaleFloorApplied).toBe(true);
  });
  it('sem faixas (como antes): nenhum desconto', () => {
    const r = calcQuoteItem({ quantity: 100 }, chaveiro, materials, costs, 0, 0)!;
    expect(r.unitPrice).toBeCloseTo(18.75, 10);
    expect(r.wholesaleDiscountPct).toBe(0);
  });
});
