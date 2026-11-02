// Estacionamento item 23: ranking dos mais vendidos (só vendas, por produto, por período).
import { describe, expect, it } from 'vitest';
import { periodStart, salesRanking } from './salesRanking';

const item = (productId: string | null, productName: string, quantity: number, totalPrice: number) => ({
  productId,
  productName,
  quantity,
  totalPrice,
});

const quotes = [
  { status: 'Aprovado', date: '2026-10-30T12:00:00.000Z', items: [item('p1', 'Caneca', 2, 60)] },
  { status: 'Finalizado', date: '2026-09-01T12:00:00.000Z', items: [item('p1', 'Caneca antiga', 1, 30)] },
  { status: 'Em produção', date: '2026-10-31T12:00:00.000Z', items: [item('p2', 'Chaveiro', 10, 50)] },
  { status: 'Pendente', date: '2026-10-31T12:00:00.000Z', items: [item('p2', 'Chaveiro', 100, 500)] },
  { status: 'Cancelado', date: '2026-10-31T12:00:00.000Z', items: [item('p1', 'Caneca', 50, 1500)] },
  { status: 'Aprovado', date: '2026-10-29T12:00:00.000Z', items: [item(null, 'Arte avulsa', 1, 120)] },
];

describe('ranking dos mais vendidos', () => {
  it('conta só Aprovado, Em produção e Finalizado, juntando pelo produto', () => {
    expect(salesRanking(quotes)).toEqual([
      { key: 'id:p2', name: 'Chaveiro', quantity: 10, revenue: 50 },
      { key: 'id:p1', name: 'Caneca', quantity: 3, revenue: 90 },
      { key: 'nome:arte avulsa', name: 'Arte avulsa', quantity: 1, revenue: 120 },
    ]);
  });

  it('ordena por faturamento quando pedido', () => {
    expect(salesRanking(quotes, { sort: 'revenue' }).map(r => r.name)).toEqual(['Arte avulsa', 'Caneca', 'Chaveiro']);
  });

  it('mostra o nome atual do cadastro (produto renomeado é uma linha só)', () => {
    const [, caneca] = salesRanking(quotes, { currentNames: { p1: 'Caneca Personalizada' } });
    expect(caneca).toMatchObject({ name: 'Caneca Personalizada', quantity: 3 });
  });

  it('filtra pela data do orçamento', () => {
    const since = periodStart('30d', new Date(2026, 10, 2));
    expect(salesRanking(quotes, { since }).find(r => r.key === 'id:p1')?.quantity).toBe(2);
  });

  it('períodos: 30 e 90 dias contam hoje; "este ano" começa em 1º de janeiro; "tudo" não tem início', () => {
    const now = new Date(2026, 10, 2, 15, 0);
    expect(periodStart('30d', now)).toBe(new Date(2026, 9, 4).toISOString());
    expect(periodStart('90d', now)).toBe(new Date(2026, 7, 5).toISOString());
    expect(periodStart('year', now)).toBe(new Date(2026, 0, 1).toISOString());
    expect(periodStart('all', now)).toBeNull();
  });
});
