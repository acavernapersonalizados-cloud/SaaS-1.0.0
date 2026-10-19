// T1 — números do cliente calculados a partir dos orçamentos (Clientes.tsx).
// Regra (18/10/2026): total gasto, nº de orçamentos e última compra contam só orçamentos
// Aprovados, Em produção e Finalizados. Pendentes não contam.
import { describe, expect, it } from 'vitest';
import { clientStats, quotesByClient } from './clientStats';

const q = (clientId: string | undefined, status: string, totalAmount: number, date: string, clientName = '') => ({
  clientId,
  clientName,
  status,
  totalAmount,
  date,
});

const clients = [
  { id: 'ana', name: 'Ana Souza' },
  { id: 'bia', name: 'Bia' },
  { id: 'joao-1', name: 'João' },
  { id: 'joao-2', name: 'joão ' },
];

describe('clientStats', () => {
  const stats = clientStats(
    [
      q('ana', 'Aprovado', 230, '2026-10-10T12:00:00.000Z'),
      q('ana', 'Pendente', 60, '2026-10-15T12:00:00.000Z'),
      q('ana', 'Finalizado', 100, '2026-09-01T12:00:00.000Z'),
      q('ana', 'Em produção', 40, '2026-10-12T12:00:00.000Z'),
      q('bia', 'Pendente', 80, '2026-10-01T12:00:00.000Z'),
      q(undefined, 'Aprovado', 999, '2026-10-16T12:00:00.000Z', 'Desconhecido'),
    ],
    clients,
  );

  it('total gasto soma só os orçamentos aprovados, em produção ou finalizados', () => {
    expect(stats.get('ana')?.totalSpent).toBe(370);
  });
  it('nº de orçamentos conta só os aprovados, em produção ou finalizados', () => {
    expect(stats.get('ana')?.quoteCount).toBe(3);
  });
  it('última compra é o orçamento não pendente mais recente', () => {
    expect(stats.get('ana')?.lastPurchase).toBe('2026-10-12T12:00:00.000Z');
  });
  it('cliente só com pendentes: tudo zerado', () => {
    expect(stats.get('bia')).toEqual({ totalSpent: 0, quoteCount: 0, lastPurchase: null });
  });
  it('orçamento sem cliente que não bate com nenhum nome não entra em ninguém', () => {
    expect([...stats.keys()].sort()).toEqual(['ana', 'bia']);
  });
  it('cliente sem orçamentos não aparece (a tela mostra zeros)', () => {
    expect(stats.get('carla')).toBeUndefined();
  });
});

describe('quotesByClient', () => {
  it('orçamento sem clientId é ligado pelo nome, sem diferença de maiúsculas e espaços', () => {
    const linked = quotesByClient(
      [q(undefined, 'Finalizado', 50, '2026-10-01T12:00:00.000Z', '  ana souza ')],
      clients,
    );
    expect(linked.get('ana')?.map(x => x.totalAmount)).toEqual([50]);
  });
  it('nome repetido em dois clientes: não liga a nenhum', () => {
    const linked = quotesByClient([q(undefined, 'Finalizado', 50, '2026-10-01T12:00:00.000Z', 'JOÃO')], clients);
    expect(linked.size).toBe(0);
  });
  it('clientId tem prioridade sobre o nome', () => {
    const linked = quotesByClient([q('bia', 'Aprovado', 10, '2026-10-01T12:00:00.000Z', 'Ana Souza')], clients);
    expect([...linked.keys()]).toEqual(['bia']);
  });
  it('lista de cada cliente vem do mais recente para o mais antigo, com todos os status', () => {
    const linked = quotesByClient(
      [q('ana', 'Pendente', 1, '2026-10-01T12:00:00.000Z'), q('ana', 'Aprovado', 2, '2026-10-05T12:00:00.000Z')],
      clients,
    );
    expect(linked.get('ana')?.map(x => x.totalAmount)).toEqual([2, 1]);
  });
});
