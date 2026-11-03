// Estacionamento item 28: data da venda (validade anda junto; lançamento original guardado) e períodos.
import { describe, expect, it } from 'vitest';
import { changeSaleDate, dayOf, isFutureDay, periodBounds } from './quoteDate';

describe('data da venda', () => {
  const q = {
    date: new Date(2026, 10, 2, 22, 30).toISOString(),
    expiryDate: new Date(2026, 10, 7, 22, 30).toISOString(),
  };

  it('muda a data, guarda o lançamento original e a validade mantém os 5 dias', () => {
    const r = changeSaleDate(q, '2026-03-15')!;
    expect(dayOf(r.date)).toBe('2026-03-15');
    expect(dayOf(r.expiryDate)).toBe('2026-03-20');
    expect(r.createdAt).toBe(q.date);
  });

  it('segunda troca não perde o lançamento original', () => {
    const first = changeSaleDate(q, '2026-03-15')!;
    const second = changeSaleDate({ ...q, ...first }, '2026-04-01')!;
    expect(second.createdAt).toBe(q.date);
    expect(dayOf(second.date)).toBe('2026-04-01');
  });

  it('mesmo dia ou dia inválido não grava nada; futuro é detectado', () => {
    expect(changeSaleDate(q, '2026-11-02')).toBeNull();
    expect(changeSaleDate(q, '15/03/2026')).toBeNull();
    expect(isFutureDay('2026-12-01', '2026-11-02')).toBe(true);
    expect(isFutureDay('2026-11-02', '2026-11-02')).toBe(false);
  });

  it('orçamento antigo sem validade: a validade fica na própria data', () => {
    const r = changeSaleDate({ date: q.date }, '2026-03-15')!;
    expect(r.expiryDate).toBe(r.date);
  });

  it('períodos do faturamento: este mês, mês passado (inclusive virada de ano) e este ano', () => {
    const now = new Date(2026, 10, 2, 10);
    expect(periodBounds('thisMonth', now)).toEqual({
      start: new Date(2026, 10, 1).toISOString(),
      end: new Date(2026, 11, 1).toISOString(),
    });
    expect(periodBounds('lastMonth', new Date(2026, 0, 15))).toEqual({
      start: new Date(2025, 11, 1).toISOString(),
      end: new Date(2026, 0, 1).toISOString(),
    });
    expect(periodBounds('thisYear', now)).toEqual({
      start: new Date(2026, 0, 1).toISOString(),
      end: new Date(2027, 0, 1).toISOString(),
    });
  });
});
