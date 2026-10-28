/**
 * kit.ts — Kit montado com produtos já cadastrados (Estacionamento item 19, aprovado em 28/10/2026).
 * Custo do kit = soma dos custos dos produtos × quantidades + custos extras (R$) + montagem (min × valor da hora).
 * Preço do kit = soma dos preços de venda dos produtos × quantidades, menos o desconto (%).
 * O kit grava custo, preço e materiais; se um produto mudar depois, o kit só muda com "Atualizar pela soma atual".
 */
import type { CostBase, Material, Product, ProductMaterial } from '../types';
import { calcProductCost, calcProductPricing, laborCostFromMinutes } from './pricingEngine';
import { roundCents } from './utils';

export interface KitLine {
  productId: string;
  name: string;
  quantity: number;
  unitCost: number;
  unitPrice: number;
  /** O produto foi apagado: fica fora das somas. */
  missing: boolean;
  /** É outro kit: não pode entrar (fica fora das somas). */
  nestedKit: boolean;
}

export interface KitTotals {
  lines: KitLine[];
  componentsCost: number;
  extrasCost: number;
  assemblyCost: number;
  totalCost: number;
  /** Soma dos preços dos produtos × quantidades, antes do desconto. */
  grossPrice: number;
  discountPct: number;
  /** Preço do kit depois do desconto. */
  price: number;
  profit: number;
  margin: number;
  belowCost: boolean;
  /** Materiais dos produtos × quantidades, somados por item (para a baixa de estoque). */
  materials: ProductMaterial[];
  /** Montagem + tempo de produção dos produtos × quantidades (min). */
  productionTime: number;
}

const num = (v: unknown) => Number(v) || 0;

/** Contas do kit com os produtos como estão agora. */
export function kitTotals(
  kit: Partial<Product>,
  products: Product[],
  materials: Material[],
  costs: CostBase | null,
): KitTotals {
  const lines: KitLine[] = (kit.kitItems || []).map(item => {
    const p = products.find(x => x.id === item.productId);
    const quantity = Math.max(0, num(item.quantity));
    if (!p)
      return {
        productId: item.productId,
        name: 'Produto apagado',
        quantity,
        unitCost: 0,
        unitPrice: 0,
        missing: true,
        nestedKit: false,
      };
    if (p.isKit)
      return { productId: p.id, name: p.name, quantity, unitCost: 0, unitPrice: 0, missing: false, nestedKit: true };
    return {
      productId: p.id,
      name: p.name,
      quantity,
      unitCost: calcProductCost(p, materials, costs).totalCost,
      unitPrice: calcProductPricing(p, materials, costs).effectivePrice,
      missing: false,
      nestedKit: false,
    };
  });
  const valid = lines.filter(l => !l.missing && !l.nestedKit);
  const componentsCost = valid.reduce((acc, l) => acc + l.unitCost * l.quantity, 0);
  const extrasCost = Math.max(0, num(kit.kitExtraCost));
  const assemblyMin = Math.max(0, num(kit.kitAssemblyMin));
  const assemblyCost = laborCostFromMinutes(num(costs?.hourlyRate), assemblyMin);
  const totalCost = componentsCost + extrasCost + assemblyCost;
  const grossPrice = valid.reduce((acc, l) => acc + l.unitPrice * l.quantity, 0);
  const discountPct = Math.min(Math.max(num(kit.kitDiscountPct), 0), 100);
  const price = grossPrice * (1 - discountPct / 100);
  const profit = price - totalCost;

  const byMaterial = new Map<string, number>();
  let productionTime = assemblyMin;
  for (const l of valid) {
    const p = products.find(x => x.id === l.productId)!;
    productionTime += num(p.productionTime) * l.quantity;
    for (const pm of p.materials || []) {
      const q = num(pm.quantity) * l.quantity;
      if (pm.materialId && q > 0) byMaterial.set(pm.materialId, (byMaterial.get(pm.materialId) ?? 0) + q);
    }
  }

  return {
    lines,
    componentsCost,
    extrasCost,
    assemblyCost,
    totalCost,
    grossPrice,
    discountPct,
    price,
    profit,
    margin: price > 0 ? (profit / price) * 100 : 0,
    belowCost: profit < -0.004,
    materials: [...byMaterial].map(([materialId, quantity]) => ({ materialId, quantity })),
    productionTime,
  };
}

/** Campos gravados no kit (o que o botão "Atualizar pela soma atual" troca). */
export const kitSnapshot = (t: KitTotals): Partial<Product> => ({
  kitCostUnit: roundCents(t.totalCost),
  kitPriceUnit: roundCents(t.grossPrice),
  materials: t.materials,
  productionTime: Math.round(t.productionTime * 100) / 100,
});

/** A soma atual dos produtos é diferente do que está gravado no kit (custo ou preço). */
export const kitSnapshotDiffers = (kit: Partial<Product>, t: KitTotals) =>
  Math.abs(num(kit.kitCostUnit) - roundCents(t.totalCost)) > 0.004 ||
  Math.abs(num(kit.kitPriceUnit) - roundCents(t.grossPrice)) > 0.004;
