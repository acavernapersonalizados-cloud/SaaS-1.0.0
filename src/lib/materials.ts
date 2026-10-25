/**
 * materials.ts — custo unitário de compra da matéria-prima.
 * Usado no cadastro (Materials.tsx) e no registro de compra (PurchaseList.tsx).
 */

type PurchaseFields = { isPackage?: boolean; unit?: string; purchaseQuantity?: number; packageQuantity?: number };

/** Material vendido em pacote: marcado como pacote ou com unidade "pct". */
export const isPackageMaterial = (m: { isPackage?: boolean; unit?: string }) =>
  Boolean(m.isPackage || m.unit === 'pct');

/** Quantidade comprada usada no custo: itens do pacote (mínimo 1) ou a quantidade comprada. */
export const materialPurchaseQuantity = (m: PurchaseFields) =>
  isPackageMaterial(m) ? m.packageQuantity || 1 : (m.purchaseQuantity as number);

/** Custo unitário: valor pago ÷ unidades compradas. */
export const unitCostFromPurchase = (totalPrice: number, units: number) => totalPrice / units;

/** Como o preço foi informado na tela: o de UMA unidade ou o valor TOTAL pago (Matéria-prima e Lista de Compras). */
export type PriceInputMode = 'unit' | 'total';

/**
 * O que é gravado a partir do valor digitado (o mesmo de sempre: valor total pago e custo por unidade).
 * "Por unidade": total = valor × unidades. "Total pago": custo = valor ÷ unidades.
 */
export function purchaseFromInput(mode: PriceInputMode, typed: number, units: number) {
  const value = Number(typed) || 0;
  const qty = Number(units) || 0;
  if (mode === 'unit') return { totalPrice: value * qty, unitCost: value };
  return { totalPrice: value, unitCost: qty > 0 ? unitCostFromPurchase(value, qty) : 0 };
}
