/**
 * productionDeadline.ts — prazo de produção do orçamento (Estacionamento item 20, aprovado em 28/10/2026).
 * Tempo = soma do tempo de produção de cada produto × quantidade. Capacidade por dia = horas produtivas do mês
 * (Base de Custos) ÷ 22. Conta só dias úteis (segunda a sexta), no mínimo 1; vale o maior entre essa conta e o
 * prazo de produção do catálogo dos produtos. É uma estimativa: não conhece feriados nem outros pedidos.
 */
import type { CostBase, Product, Quote } from '../types';

export const WORKING_DAYS_PER_MONTH = 22;

const num = (v: unknown) => Number(v) || 0;

/** Data local no formato AAAA-MM-DD (o prazo é um dia, sem hora). */
export const localDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Soma dias úteis (segunda a sexta) a partir do dia de início (o dia de início não conta). */
export function addBusinessDays(start: Date, days: number): Date {
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  let left = Math.max(0, Math.round(days));
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return d;
}

/** Minutos de produção do orçamento: tempo de cada produto × quantidade. */
export function quoteProductionMinutes(quote: Pick<Quote, 'items'>, products: Product[]): number {
  return (quote.items || []).reduce((acc, item) => {
    const p = products.find(x => x.id === item.productId);
    return acc + num(p?.productionTime) * Math.max(0, num(item.quantity));
  }, 0);
}

/** Minutos de trabalho por dia: horas produtivas do mês ÷ 22 dias úteis (no mínimo 1 hora). */
export const dailyCapacityMinutes = (costs: Pick<CostBase, 'productiveHours'> | null | undefined) =>
  Math.max(60, (num(costs?.productiveHours) / WORKING_DAYS_PER_MONTH) * 60);

export interface ProductionDeadline {
  productionStartedAt: string;
  productionDueAt: string;
  businessDays: number;
}

/** Prazo a partir de "start": o maior entre a conta pelo tempo e o prazo do catálogo dos produtos (mínimo 1 dia). */
export function productionDeadline(
  quote: Pick<Quote, 'items'>,
  products: Product[],
  costs: Pick<CostBase, 'productiveHours'> | null | undefined,
  start: Date,
): ProductionDeadline {
  const byTime = Math.ceil(quoteProductionMinutes(quote, products) / dailyCapacityMinutes(costs));
  const byCatalog = (quote.items || []).reduce((acc, item) => {
    const p = products.find(x => x.id === item.productId);
    return Math.max(acc, Math.ceil(num(p?.leadTimeDays)));
  }, 0);
  const businessDays = Math.max(1, byTime, byCatalog);
  return {
    productionStartedAt: start.toISOString(),
    productionDueAt: localDay(addBusinessDays(start, businessDays)),
    businessDays,
  };
}

export type DeadlineStatus =
  { kind: 'none' } | { kind: 'ok' | 'today'; dueAt: string } | { kind: 'late'; dueAt: string; daysLate: number };

/** Situação do prazo hoje: atrasado (vermelho), vence hoje (amarelo), no prazo, ou sem prazo. */
export function deadlineStatus(dueAt: string | undefined, today: Date): DeadlineStatus {
  if (!dueAt || !/^\d{4}-\d{2}-\d{2}$/.test(dueAt)) return { kind: 'none' };
  const t = localDay(today);
  if (dueAt === t) return { kind: 'today', dueAt };
  if (dueAt > t) return { kind: 'ok', dueAt };
  const [y, m, d] = dueAt.split('-').map(Number);
  const daysLate = Math.round(
    (new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() - new Date(y, m - 1, d).getTime()) /
      86_400_000,
  );
  return { kind: 'late', dueAt, daysLate };
}

/** "28/10" a partir de "2026-10-28". */
export const shortDate = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;
