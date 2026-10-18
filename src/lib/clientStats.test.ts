// T1 — números do cliente calculados a partir dos orçamentos (Clientes.tsx).
import { describe, expect, it } from 'vitest';
import { clientStats } from './clientStats';

const q = (clientId: string | undefined, status: string, totalAmount: number, date: string) => ({
  clientId,
  status,
  totalAmount,
  date,
});

describe('clientStats', () => {
  const stats = clientStats([
    q('ana', 'Aprovado', 230, '2026-10-10T12:00:00.000Z'),
    q('ana', 'Pendente', 60, '2026-10-15T12:00:00.000Z'),
    q('ana', 'Finalizado', 100, '2026-09-01T12:00:00.000Z'),
    q('ana', 'Em produção', 40, '2026-10-12T12:00:00.000Z'),
    q('bia', 'Pendente', 80, '2026-10-01T12:00:00.000Z'),
    q(undefined, 'Aprovado', 999, '2026-10-16T12:00:00.000Z'),
  ]);

  it('total gasto soma só os orçamentos aprovados, em produção ou finalizados', () => {
    expect(stats.get('ana')?.totalSpent).toBe(370);
  });
  it('conta todos os orçamentos do cliente, inclusive os pendentes', () => {
    expect(stats.get('ana')?.quoteCount).toBe(4);
  });
  it('última compra é o orçamento não pendente mais recente', () => {
    expect(stats.get('ana')?.lastPurchase).toBe('2026-10-12T12:00:00.000Z');
  });
  it('cliente só com pendentes: total 0 e sem última compra', () => {
    expect(stats.get('bia')).toEqual({ totalSpent: 0, quoteCount: 1, lastPurchase: null });
  });
  it('orçamento sem cliente vinculado não entra em ninguém', () => {
    expect([...stats.keys()].sort()).toEqual(['ana', 'bia']);
  });
  it('cliente sem orçamentos não aparece (a tela mostra zeros)', () => {
    expect(stats.get('carla')).toBeUndefined();
  });
});
