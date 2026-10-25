// Custo unitário de compra — comportamento atual de Materials.tsx (cadastro) e
// PurchaseList.tsx (registro de compra). Valores do CHECKLIST-TESTES.md, seções 7 e 16.
import { describe, expect, it } from 'vitest';
import { isPackageMaterial, materialPurchaseQuantity, purchaseFromInput, unitCostFromPurchase } from './materials';
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

// Seletor "Informar: preço por unidade / valor total pago": a mesma compra grava o mesmo nos dois modos.
describe('Preço por unidade ou valor total pago', () => {
  it('10 canecas de R$ 9: "por unidade" R$ 9 = "total pago" R$ 90 → total R$ 90 e R$ 9,00/un', () => {
    expect(purchaseFromInput('unit', 9, 10)).toEqual({ totalPrice: 90, unitCost: 9 });
    expect(purchaseFromInput('total', 90, 10)).toEqual({ totalPrice: 90, unitCost: 9 });
  });
  it('"total pago" é o comportamento de sempre (TESTE MDF: R$ 60 por 4 → R$ 15)', () => {
    expect(purchaseFromInput('total', 60, 4)).toEqual({ totalPrice: 60, unitCost: unitCostFromPurchase(60, 4) });
  });
  it('pacote: por unidade = por item do pacote (Argola R$ 0,25 × 100 = R$ 25)', () => {
    const argola = { unit: 'pct', purchaseQuantity: 1, packageQuantity: 100 };
    const units = materialPurchaseQuantity(argola);
    expect(purchaseFromInput('unit', 0.25, units)).toEqual({ totalPrice: 25, unitCost: 0.25 });
    expect(purchaseFromInput('total', 25, units)).toEqual({ totalPrice: 25, unitCost: 0.25 });
  });
  it('sem quantidade: custo 0 no total (não divide por zero)', () => {
    expect(purchaseFromInput('total', 50, 0)).toEqual({ totalPrice: 50, unitCost: 0 });
  });
});
