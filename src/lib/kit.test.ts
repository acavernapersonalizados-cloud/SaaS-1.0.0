// Estacionamento item 19 (28/10/2026): Kit com produtos já cadastrados, custos extras e montagem.
import { describe, expect, it } from 'vitest';
import type { CostBase, Product } from '../types';
import { calcProductCost, calcProductPricing, calcQuoteItem } from './pricingEngine';
import { kitSnapshot, kitSnapshotDiffers, kitTotals } from './kit';

const costs = { hourlyRate: 30 } as unknown as CostBase; // R$ 30/h = R$ 0,50 por minuto
// Produtos com custo e preço fixos (custo do trabalho e preço manual), para a conta ficar clara.
const prod = (id: string, cost: number, price: number, extra: Partial<Product> = {}) =>
  ({ id, storeId: 'l', name: id, jobCostUnit: cost, manualPrice: price, ...extra }) as unknown as Product;
const caneca = prod('caneca', 10, 30, {
  productionTime: 15,
  materials: [{ materialId: 'caneca-branca', quantity: 1 }],
});
const chocolate = prod('chocolate', 4, 9, { materials: [{ materialId: 'barra', quantity: 2 }] });
const products = [caneca, chocolate];
const kit = (extra: Partial<Product> = {}): Partial<Product> => ({
  isKit: true,
  kitItems: [
    { productId: 'caneca', quantity: 1 },
    { productId: 'chocolate', quantity: 3 },
  ],
  ...extra,
});

describe('kitTotals', () => {
  it('custo = produtos × quantidades; preço = soma dos preços', () => {
    const t = kitTotals(kit(), products, [], costs);
    expect(t.totalCost).toBeCloseTo(10 + 3 * 4, 10); // R$ 22,00 (só os produtos: sem extras nem montagem)
    expect(t.grossPrice).toBeCloseTo(30 + 3 * 9, 10); // R$ 57,00
    expect(t.price).toBeCloseTo(57, 10);
    expect(t.profit).toBeCloseTo(35, 10);
    expect(t.margin).toBeCloseTo((35 / 57) * 100, 10);
  });
  it('desconto do kit sobre a soma dos preços; abaixo do custo avisa', () => {
    expect(kitTotals(kit({ kitDiscountPct: 10 }), products, [], costs).price).toBeCloseTo(51.3, 10);
    expect(kitTotals(kit({ kitDiscountPct: 70 }), products, [], costs).belowCost).toBe(true);
  });
  it('materiais dos produtos × quantidades, para a baixa de estoque; tempo = soma dos tempos × quantidades', () => {
    const t = kitTotals(kit(), products, [], costs);
    expect(t.materials).toEqual([
      { materialId: 'caneca-branca', quantity: 1 },
      { materialId: 'barra', quantity: 6 },
    ]);
    expect(t.productionTime).toBe(15); // caneca 15 min × 1 + chocolate 0 min × 3
  });
  it('kit dentro de kit e produto apagado ficam fora das somas (e marcados)', () => {
    const outro = prod('outro-kit', 50, 90, { isKit: true });
    const t = kitTotals(
      {
        isKit: true,
        kitItems: [
          { productId: 'outro-kit', quantity: 1 },
          { productId: 'sumiu', quantity: 1 },
        ],
      },
      [outro],
      [],
      costs,
    );
    expect(t.lines.map(l => [l.nestedKit, l.missing])).toEqual([
      [true, false],
      [false, true],
    ]);
    expect([t.totalCost, t.grossPrice]).toEqual([0, 0]);
  });
});

describe('kit gravado (o botão "Atualizar pela soma atual")', () => {
  it('grava custo, preço, materiais e tempo; percebe quando a soma atual mudou', () => {
    const saved = { ...kit(), ...kitSnapshot(kitTotals(kit(), products, [], costs)) };
    expect([saved.kitCostUnit, saved.kitPriceUnit, saved.productionTime]).toEqual([22, 57, 15]);
    expect(kitSnapshotDiffers(saved, kitTotals(saved, products, [], costs))).toBe(false);
    const caneca2 = { ...caneca, manualPrice: 35 };
    expect(kitSnapshotDiffers(saved, kitTotals(saved, [caneca2, chocolate], [], costs))).toBe(true);
  });
  it('o custo e o preço do produto kit são os gravados (sem refazer contas)', () => {
    const saved = { ...kit({ kitDiscountPct: 10 }), kitCostUnit: 24, kitPriceUnit: 57 } as Product;
    expect(calcProductCost(saved, [], costs)).toMatchObject({ kitCost: 24, totalCost: 24, materialCost: 0 });
    expect(calcProductPricing(saved, [], costs).suggestedPrice).toBeCloseTo(51.3, 10);
  });
  it('no orçamento, o kit sai pelo preço do kit (venda direta) e mantém o lucro com taxa de canal', () => {
    const saved = { ...kit({ kitDiscountPct: 10 }), id: 'kit', kitCostUnit: 24, kitPriceUnit: 57 } as Product;
    const costsMarkup = { hourlyRate: 30, markupPct: 100 } as unknown as CostBase;
    const direto = calcQuoteItem({ quantity: 2 }, saved, [], costsMarkup, 0)!;
    expect(direto.unitPrice).toBeCloseTo(51.3, 10); // e não 24 × 2 = 48 (markup da loja)
    const shopee = calcQuoteItem({ quantity: 2 }, saved, [], costsMarkup, 20)!;
    expect(shopee.itemProfit).toBeCloseTo(direto.itemProfit, 10);
    expect(calcQuoteItem({ quantity: 1, manualUnitPrice: 40 }, saved, [], costsMarkup, 0)!.unitPrice).toBe(40);
  });
  it('produto comum não muda', () => {
    expect(calcProductCost(caneca, [], costs)).toEqual({
      materialCost: 0,
      laborCost: 0,
      packagingCost: 0,
      jobCost: 10,
      totalCost: 10,
    });
  });
});
