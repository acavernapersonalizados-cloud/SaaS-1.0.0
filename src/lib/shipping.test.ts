// Estacionamento item 26: frete no orçamento (cliente paga × frete grátis).
import { describe, expect, it } from 'vitest';
import { productsTotalOf, quoteTotals, shippingLabel } from './shipping';

describe('frete no orçamento', () => {
  it('sem frete: igual a antes (total = itens, crédito = ÷ 0,95)', () => {
    const t = quoteTotals(100, 40);
    expect(t).toMatchObject({
      productsTotal: 100,
      totalAmount: 100,
      totalProfit: 40,
      avgMargin: 40,
      shippingAmount: 0,
    });
    expect(t.creditTotal).toBeCloseTo(100 / 0.95, 10);
  });

  it('cliente paga: soma no total e no crédito; lucro e margem não mudam', () => {
    const t = quoteTotals(100, 40, 25, 'cliente');
    expect(t.totalAmount).toBe(125);
    expect(t.creditTotal).toBeCloseTo(125 / 0.95, 10);
    expect(t.totalProfit).toBe(40);
    expect(t.avgMargin).toBe(40);
  });

  it('frete grátis (loja paga): não soma no total; reduz o lucro e a margem (pode ficar negativo)', () => {
    const t = quoteTotals(100, 40, 25, 'loja');
    expect(t.totalAmount).toBe(100);
    expect(t.creditTotal).toBeCloseTo(100 / 0.95, 10);
    expect(t.totalProfit).toBe(15);
    expect(t.avgMargin).toBe(15);
    expect(quoteTotals(100, 10, 25, 'loja').totalProfit).toBe(-15);
  });

  it('faturamento só dos produtos; orçamento antigo sem frete fica igual', () => {
    expect(
      productsTotalOf({ totalAmount: 125, productsTotal: 100, shippingAmount: 25, shippingPaidBy: 'cliente' }),
    ).toBe(100);
    expect(productsTotalOf({ totalAmount: 230 })).toBe(230);
    expect(shippingLabel({ totalAmount: 230 })).toBeNull();
    expect(shippingLabel({ shippingAmount: 25, shippingPaidBy: 'loja' })).toBe('Frete grátis (pago pela loja)');
    expect(shippingLabel({ shippingAmount: 25, shippingPaidBy: 'cliente' })).toBe('Frete (pago pelo cliente)');
  });
});
