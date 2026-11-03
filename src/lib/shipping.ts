/**
 * shipping.ts — frete no orçamento (Estacionamento item 26, 2/11/2026). Opcional. "Quem paga":
 * - cliente: soma no total (e no crédito, total ÷ 0,95); fora do lucro e da margem;
 * - loja (frete grátis): não soma no total; entra como custo e reduz o lucro.
 * Fica fora do desconto de atacado e do ranking de mais vendidos (que usam só os itens). Orçamento antigo, sem os
 * campos, é lido como "sem frete" e nada muda.
 */
import { creditPrice } from './pricingEngine';

export type ShippingPaidBy = 'cliente' | 'loja';

export interface QuoteTotals {
  /** Soma dos itens (sem frete). */
  productsTotal: number;
  /** Total a pagar: itens + frete quando o cliente paga. */
  totalAmount: number;
  creditTotal: number;
  /** Lucro dos itens, menos o frete quando a loja paga. */
  totalProfit: number;
  /** Margem (%) sobre os itens. */
  avgMargin: number;
  shippingAmount: number;
  shippingPaidBy: ShippingPaidBy;
}

const money = (n: number) => (Number.isFinite(n) ? n : 0);

export function quoteTotals(
  itemsTotal: number,
  itemsProfit: number,
  shippingAmount = 0,
  shippingPaidBy: ShippingPaidBy = 'cliente',
): QuoteTotals {
  const productsTotal = money(itemsTotal);
  const shipping = Math.max(0, money(Number(shippingAmount)));
  const totalAmount = productsTotal + (shippingPaidBy === 'cliente' ? shipping : 0);
  const totalProfit = money(itemsProfit) - (shippingPaidBy === 'loja' ? shipping : 0);
  return {
    productsTotal,
    totalAmount,
    creditTotal: creditPrice(totalAmount),
    totalProfit,
    avgMargin: productsTotal > 0 ? (totalProfit / productsTotal) * 100 : 0,
    shippingAmount: shipping,
    shippingPaidBy,
  };
}

type QuoteShipping = { totalAmount?: number; productsTotal?: number; shippingAmount?: number; shippingPaidBy?: string };

/** Frete do orçamento (0 nos antigos). */
export const shippingOf = (q: QuoteShipping) => Math.max(0, Number(q.shippingAmount) || 0);

/** Só os produtos (faturamento do Dashboard): o gravado, ou o total menos o frete do cliente nos antigos. */
export function productsTotalOf(q: QuoteShipping): number {
  if (q.productsTotal !== undefined && q.productsTotal !== null) return Number(q.productsTotal) || 0;
  return (Number(q.totalAmount) || 0) - (q.shippingPaidBy === 'cliente' ? shippingOf(q) : 0);
}

/** Texto do frete para tela e PDF: "Frete (pago pelo cliente)" / "Frete grátis (pago pela loja)"; null = sem frete. */
export function shippingLabel(q: QuoteShipping): string | null {
  if (shippingOf(q) <= 0) return null;
  return q.shippingPaidBy === 'loja' ? 'Frete grátis (pago pela loja)' : 'Frete (pago pelo cliente)';
}
