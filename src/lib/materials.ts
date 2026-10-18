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
