// Estacionamento item 20 (28/10/2026): prazo de produção em dias úteis. 28/10/2026 é quarta; 30/10 é sexta.
import { describe, expect, it } from 'vitest';
import type { Product, Quote } from '../types';
import {
  addBusinessDays,
  dailyCapacityMinutes,
  deadlineStatus,
  localDay,
  productionDeadline,
  quoteProductionMinutes,
} from './productionDeadline';

const at = (day: string, h = 10) => new Date(`${day}T${String(h).padStart(2, '0')}:00:00`);
const prod = (id: string, productionTime: number, leadTimeDays?: number) =>
  ({ id, name: id, productionTime, leadTimeDays }) as unknown as Product;
const quote = (items: Array<[string, number]>) =>
  ({ items: items.map(([productId, quantity]) => ({ productId, quantity })) }) as unknown as Pick<Quote, 'items'>;
const costs = { productiveHours: 176 }; // 176 h ÷ 22 = 8 h por dia = 480 min

describe('dias úteis (segunda a sexta)', () => {
  it('sexta + 1 dia útil = segunda; quarta + 3 = segunda', () => {
    expect(localDay(addBusinessDays(at('2026-10-30'), 1))).toBe('2026-11-02');
    expect(localDay(addBusinessDays(at('2026-10-28'), 3))).toBe('2026-11-02');
    expect(localDay(addBusinessDays(at('2026-10-28'), 1))).toBe('2026-10-29');
  });
});

describe('productionDeadline', () => {
  const products = [prod('caneca', 30), prod('cesta', 120, 5), prod('sem-tempo', 0)];
  it('tempo × quantidade ÷ (horas produtivas ÷ 22 por dia)', () => {
    expect(quoteProductionMinutes(quote([['caneca', 20]]), products)).toBe(600);
    expect(dailyCapacityMinutes(costs)).toBe(480);
    const d = productionDeadline(quote([['caneca', 20]]), products, costs, at('2026-10-28'));
    expect(d.businessDays).toBe(2); // 600 min ÷ 480 = 1,25 → 2 dias úteis
    expect(d.productionDueAt).toBe('2026-10-30');
  });
  it('vale o maior entre a conta e o prazo do catálogo', () => {
    const d = productionDeadline(quote([['cesta', 1]]), products, costs, at('2026-10-28'));
    expect(d.businessDays).toBe(5); // 120 min daria 1 dia; o catálogo diz 5
    expect(d.productionDueAt).toBe('2026-11-04');
  });
  it('sem tempo de produção: mínimo de 1 dia útil', () => {
    expect(productionDeadline(quote([['sem-tempo', 3]]), products, costs, at('2026-10-30')).productionDueAt).toBe(
      '2026-11-02',
    );
  });
  it('sem horas produtivas na Base de Custos: 1 hora por dia', () => {
    expect(dailyCapacityMinutes(null)).toBe(60);
  });
});

describe('deadlineStatus', () => {
  it('atrasado, vence hoje, no prazo e sem prazo', () => {
    expect(deadlineStatus('2026-10-26', at('2026-10-28'))).toEqual({ kind: 'late', dueAt: '2026-10-26', daysLate: 2 });
    expect(deadlineStatus('2026-10-28', at('2026-10-28', 23))).toEqual({ kind: 'today', dueAt: '2026-10-28' });
    expect(deadlineStatus('2026-10-30', at('2026-10-28'))).toEqual({ kind: 'ok', dueAt: '2026-10-30' });
    expect(deadlineStatus(undefined, at('2026-10-28'))).toEqual({ kind: 'none' });
  });
});
