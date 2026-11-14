// Material em pacote com estoque por item (correção de 14/11/2026).
import { describe, expect, it } from 'vitest';
import type { CostBase, Material, Product } from '../types';
import { calcProductCost } from './pricingEngine';
import { materialLots, takeFromLots } from './stockLots';
import { convertPackageStock, legacyPackageStock, packageBreakdown, packageStockText, stockByItem } from './packages';

const sulfite = {
  id: 'sulfite',
  name: 'Sulfite A4',
  unit: 'pct',
  isPackage: true,
  packageQuantity: 500,
  unitCost: 0.05,
  stockQuantity: 2,
  minStockQuantity: 1,
} as unknown as Material;

describe('Correção de 14/11: pacote por item', () => {
  it('pacote antigo precisa de conversão; o novo não; material comum não é pacote', () => {
    expect(legacyPackageStock(sulfite)).toBe(true);
    expect(stockByItem(sulfite)).toBe(false);
    expect(stockByItem({ ...sulfite, stockByItem: true })).toBe(true);
    expect(legacyPackageStock({ unit: 'kg' })).toBe(false);
    expect(stockByItem({ unit: 'un', stockByItem: true })).toBe(false);
  });
  it('converte pacotes em itens: 2 pct → 1.000, mínimo 1 → 500, "pct" vira "un"', () => {
    expect(convertPackageStock(sulfite, false)).toEqual({
      factor: 500,
      fields: { stockQuantity: 1000, minStockQuantity: 500, unit: 'un', stockByItem: true },
    });
  });
  it('saldo que já estava em itens não multiplica', () => {
    const r = convertPackageStock({ ...sulfite, unit: 'un', stockQuantity: 730 }, true);
    expect(r.factor).toBe(1);
    expect(r.fields.stockQuantity).toBe(730);
  });
  it('pacotes e avulsos: 1.030 = 2 pct + 30; menos de um pacote = 0 + resto', () => {
    expect(packageBreakdown(1030, 500)).toEqual({ packs: 2, loose: 30 });
    expect(packageBreakdown(499.5, 500)).toEqual({ packs: 0, loose: 499.5 });
    expect(packageBreakdown(1000, 500)).toEqual({ packs: 2, loose: 0 });
  });
  it('texto do saldo mostra os dois', () => {
    const item = { ...sulfite, unit: 'un', stockByItem: true, stockQuantity: 1030 };
    expect(packageStockText(item)).toBe('1.030 un (2 pct + 30)');
    expect(packageStockText({ unit: 'kg', stockQuantity: 1.5 })).toBe('1,5 kg');
  });
  it('o caderno de 50 folhas baixa 50 do saldo por item', () => {
    const item = { ...sulfite, ...convertPackageStock(sulfite, false).fields } as Material;
    const r = takeFromLots(materialLots(item, '2026-11-14'), 50, '2026-11-14');
    expect(r.missing).toBe(0);
    expect(r.lots.reduce((s, l) => s + l.quantity, 0)).toBe(950);
  });
  it('o custo da receita não muda com a conversão (já era por folha)', () => {
    const caderno = { materials: [{ materialId: 'sulfite', quantity: 50 }] } as unknown as Product;
    const costs = { hourlyRate: 0 } as unknown as CostBase;
    const before = calcProductCost(caderno, [sulfite], costs).materialCost;
    const after = calcProductCost(caderno, [{ ...sulfite, ...convertPackageStock(sulfite, false).fields }], costs);
    expect(before).toBeCloseTo(2.5, 10);
    expect(after.materialCost).toBeCloseTo(before, 10);
  });
});
