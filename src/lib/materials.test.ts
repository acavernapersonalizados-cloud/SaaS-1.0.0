// Custo unitário de compra — comportamento atual de Materials.tsx (cadastro) e
// PurchaseList.tsx (registro de compra). Valores do CHECKLIST-TESTES.md, seções 7 e 16.
import { describe, expect, it } from 'vitest';
import { isPackageMaterial, materialPurchaseQuantity, unitCostFromPurchase } from './materials';
import { packageSize } from './utils';

describe('Cadastro de matéria-prima (seção 7)', () => {
  const unitCostOf = (m: Parameters<typeof materialPurchaseQuantity>[0] & { purchasePrice: number }) =>
    unitCostFromPurchase(m.purchasePrice, materialPurchaseQuantity(m));

  it('TESTE MDF 3mm: R$ 60 por 4 un → R$ 15,00', () => {
    const mdf = { unit: 'un', purchasePrice: 60, purchaseQuantity: 4, packageQuantity: 1, isPackage: false };
    expect(isPackageMaterial(mdf)).toBe(false);
    expect(materialPurchaseQuantity(mdf)).toBe(4);
    expect(unitCostOf(mdf)).toBe(15);
  });
  it('TESTE Argola: unidade "pct" vira pacote; R$ 25 por 100 itens → R$ 0,25', () => {
    const argola = { unit: 'pct', purchasePrice: 25, purchaseQuantity: 0, packageQuantity: 100, isPackage: false };
    expect(isPackageMaterial(argola)).toBe(true);
    expect(materialPurchaseQuantity(argola)).toBe(100);
    expect(unitCostOf(argola)).toBe(0.25);
  });
  it('TESTE Fita cetim: R$ 12 por 10 m → R$ 1,20', () => {
    const fita = { unit: 'm', purchasePrice: 12, purchaseQuantity: 10, packageQuantity: 1, isPackage: false };
    expect(unitCostOf(fita)).toBe(1.2);
  });
  it('pacote marcado na caixa (unidade "un"): usa a quantidade de itens do pacote', () => {
    const caixa = { unit: 'un', purchasePrice: 30, purchaseQuantity: 7, packageQuantity: 10, isPackage: true };
    expect(isPackageMaterial(caixa)).toBe(true);
    expect(materialPurchaseQuantity(caixa)).toBe(10);
    expect(unitCostOf(caixa)).toBe(3);
  });
  it('pacote sem quantidade de itens conta como 1', () => {
    expect(materialPurchaseQuantity({ unit: 'pct', purchaseQuantity: 5, packageQuantity: 0 })).toBe(1);
  });
});

describe('Registro de compra na Lista de Compras (seção 16)', () => {
  it('16.7 TESTE Fita cetim: 8 m por R$ 40 → R$ 5,00', () => {
    const units = 8 * packageSize({ unit: 'm' });
    expect(units).toBe(8);
    expect(unitCostFromPurchase(40, units)).toBe(5);
  });
  it('16.9 TESTE Argola: 1 pacote de 100 por R$ 25 → +100 itens a R$ 0,25', () => {
    const units = 1 * packageSize({ unit: 'pct', packageQuantity: 100 });
    expect(units).toBe(100);
    expect(unitCostFromPurchase(25, units)).toBe(0.25);
  });
});
