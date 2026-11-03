// Estacionamento item 21: validade por lotes (ordem de consumo, entrada, conversão do estoque antigo).
import { describe, expect, it } from 'vitest';
import {
  addToLots,
  changeLotExpiry,
  consumptionOrder,
  daysUntil,
  discardLot,
  expiryRisk,
  lossSummary,
  expiryAlerts,
  expiryWarningDaysOf,
  lotAlert,
  lotAlertText,
  lotsTotal,
  materialLots,
  StockLot,
  stockFields,
  suggestLots,
  takeFromLots,
  todayISO,
  usableTotal,
} from './stockLots';

const TODAY = '2026-11-02';
const lot = (id: string, quantity: number, expiresAt: string | null, createdAt = '2026-10-01T00:00:00.000Z') => ({
  id,
  quantity,
  expiresAt,
  createdAt,
});
const lots: StockLot[] = [
  lot('sem', 5, null),
  lot('dez', 4, '2026-12-10'),
  lot('venc', 3, '2026-11-01'),
  lot('nov', 2, '2026-11-02'),
];

describe('validade por lotes', () => {
  it('consome o não vencido que vence antes; "sem validade" por último; vencido fica de fora', () => {
    expect(consumptionOrder(lots, TODAY).map(l => l.id)).toEqual(['nov', 'dez', 'sem']);
    expect(usableTotal(lots, TODAY)).toBe(11);
  });

  it('a baixa tira na ordem e zera lotes; o que falta não sai dos vencidos', () => {
    const r = takeFromLots(lots, 7, TODAY);
    expect(r.taken).toEqual([
      { lotId: 'nov', expiresAt: '2026-11-02', quantity: 2 },
      { lotId: 'dez', expiresAt: '2026-12-10', quantity: 4 },
      { lotId: 'sem', expiresAt: null, quantity: 1 },
    ]);
    expect(r.lots.map(l => [l.id, l.quantity])).toEqual([
      ['sem', 4],
      ['venc', 3],
    ]);
    const all = takeFromLots(lots, 20, TODAY);
    expect(all.missing).toBe(9);
    expect(all.lots).toEqual([lot('venc', 3, '2026-11-01')]);
  });

  it('entrada junta com o lote de mesma validade ou cria um novo', () => {
    expect(addToLots(lots, 6, '2026-12-10').find(l => l.id === 'dez')?.quantity).toBe(10);
    const novo = addToLots(lots, 1.5, '2027-01-31', '2026-11-02T10:00:00.000Z');
    expect(novo).toHaveLength(5);
    expect(novo[4]).toMatchObject({ quantity: 1.5, expiresAt: '2027-01-31' });
    expect(addToLots(lots, 2, null).find(l => l.id === 'sem')?.quantity).toBe(7);
  });

  it('estoque de antes vira um lote "sem validade", sem perder nada', () => {
    const r = materialLots({ stockQuantity: 12.5, createdAt: '2026-01-01T00:00:00.000Z' }, TODAY);
    expect(r).toHaveLength(1);
    expect(r[0]).toEqual({
      id: 'sem-validade',
      quantity: 12.5,
      expiresAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(materialLots({ stockQuantity: 0 }, TODAY)).toEqual([]);
  });

  it('saldo mudado por fora: a diferença entra como "sem validade" ou sai na ordem (e dos vencidos, se precisar)', () => {
    expect(stockFields(materialLots({ stockQuantity: 16, stockLots: lots }, TODAY)).stockQuantity).toBe(16);
    expect(materialLots({ stockQuantity: 16, stockLots: lots }, TODAY).find(l => l.id === 'sem')?.quantity).toBe(7);
    expect(materialLots({ stockQuantity: 2, stockLots: lots }, TODAY)).toEqual([lot('venc', 2, '2026-11-01')]);
  });

  it('casas decimais não acumulam erro', () => {
    const r = takeFromLots([lot('a', 0.3, null)], 0.1, TODAY);
    expect(stockFields(r.lots).stockQuantity).toBe(0.2);
  });

  it('sugestão da reserva: os outros orçamentos reservados pegam primeiro', () => {
    expect(suggestLots(lots, 3, 4, TODAY)).toEqual([
      { lotId: 'dez', expiresAt: '2026-12-10', quantity: 3 },
      { lotId: 'sem', expiresAt: null, quantity: 1 },
    ]);
  });

  it('alterar validade: parte do lote vira outro lote; o lote inteiro só troca a data; mesma data junta', () => {
    const base = [lot('sem', 10, null)];
    const parte = changeLotExpiry(base, 'sem', 6, '2026-12-10', '2026-11-02T10:00:00.000Z');
    expect('lots' in parte && parte.lots.map(l => [l.quantity, l.expiresAt])).toEqual([
      [4, null],
      [6, '2026-12-10'],
    ]);
    const inteiro = changeLotExpiry(base, 'sem', 10, '2027-01-31');
    expect('lots' in inteiro && inteiro.lots).toEqual([lot('sem', 10, '2027-01-31')]);
    const junta = changeLotExpiry(lots, 'sem', 5, '2026-12-10');
    expect('lots' in junta && junta.lots.map(l => [l.id, l.quantity])).toEqual([
      ['dez', 9],
      ['venc', 3],
      ['nov', 2],
    ]);
    const volta = changeLotExpiry(lots, 'dez', 4, null);
    expect('lots' in volta && volta.lots.find(l => l.id === 'sem')?.quantity).toBe(9);
    for (const r of [parte, inteiro, junta, volta])
      expect('lots' in r && lotsTotal(r.lots)).toBe(lotsTotal('lots' in r ? r.lots : []));
    expect('lots' in junta && lotsTotal(junta.lots)).toBe(lotsTotal(lots));
  });

  it('alterar validade: quantidade 0, negativa ou maior que o lote é recusada', () => {
    expect(changeLotExpiry(lots, 'sem', 0, '2026-12-10')).toEqual({ error: 'Informe uma quantidade maior que zero.' });
    expect(changeLotExpiry(lots, 'sem', -1, '2026-12-10')).toEqual({ error: 'Informe uma quantidade maior que zero.' });
    expect(changeLotExpiry(lots, 'sem', 6, '2026-12-10')).toEqual({ error: 'A quantidade passa do lote (5).' });
  });

  it('21B: prazo do aviso da loja (padrão 30, de 0 a 365)', () => {
    expect(expiryWarningDaysOf(null)).toBe(30);
    expect(expiryWarningDaysOf({})).toBe(30);
    expect(expiryWarningDaysOf({ expiryWarningDays: 7 })).toBe(7);
    expect(expiryWarningDaysOf({ expiryWarningDays: 0 })).toBe(0);
    expect(expiryWarningDaysOf({ expiryWarningDays: -3 })).toBe(30);
    expect(expiryWarningDaysOf({ expiryWarningDays: 999 })).toBe(365);
  });

  it('21B: vermelho vencido, amarelo dentro do prazo, nada fora do prazo ou sem validade', () => {
    expect(lotAlert({ expiresAt: '2026-11-01' }, TODAY, 30)).toEqual({ kind: 'expired' });
    expect(lotAlert({ expiresAt: '2026-11-02' }, TODAY, 30)).toEqual({ kind: 'soon', days: 0 });
    expect(lotAlert({ expiresAt: '2026-12-02' }, TODAY, 30)).toEqual({ kind: 'soon', days: 30 });
    expect(lotAlert({ expiresAt: '2026-12-03' }, TODAY, 30)).toBeNull();
    expect(lotAlert({ expiresAt: null }, TODAY, 30)).toBeNull();
    expect(lotAlertText({ kind: 'soon', days: 0 })).toBe('vence hoje');
    expect(lotAlertText({ kind: 'soon', days: 1 })).toBe('vence amanhã');
    expect(lotAlertText({ kind: 'soon', days: 12 })).toBe('vence em 12 dias');
    expect(daysUntil('2027-03-01', '2027-02-28')).toBe(1);
  });

  it('21B: avisos da loja, vencidos primeiro', () => {
    const rows = expiryAlerts([{ id: 'm1', name: 'Tinta', unit: 'ml', stockQuantity: 14, stockLots: lots }], TODAY, 30);
    expect(rows.map(r => [r.lot.id, r.alert.kind])).toEqual([
      ['venc', 'expired'],
      ['nov', 'soon'],
    ]);
  });

  it('21B: descartar lote tira o lote inteiro e o saldo cai junto', () => {
    const r = discardLot(lots, 'venc');
    expect('lots' in r && stockFields(r.lots).stockQuantity).toBe(11);
    expect('removed' in r && r.removed.quantity).toBe(3);
    expect(discardLot(lots, 'xx')).toEqual({ error: 'Lote não encontrado (o estoque mudou). Abra de novo.' });
  });

  it('27: perdido no mês e no ano pelos descartes; descarte antigo sem custo vale o custo de hoje (aprox.)', () => {
    const mats = [
      { id: 'tinta', unitCost: 0.5 },
      { id: 'caneca', unitCost: 10 },
    ];
    const r = lossSummary(
      [
        { materialId: 'caneca', quantity: 2, unitCost: 9, value: 18, createdAt: '2026-11-02T15:00:00.000Z' },
        { materialId: 'tinta', quantity: 100, createdAt: '2026-11-01T15:00:00.000Z' },
        { materialId: 'caneca', quantity: 1, unitCost: 8, value: 8, createdAt: '2026-03-10T15:00:00.000Z' },
        { materialId: 'caneca', quantity: 5, value: 50, createdAt: '2025-12-30T15:00:00.000Z' },
      ],
      mats,
      new Date(2026, 10, 2, 12),
    );
    expect(r).toEqual({ month: 68, year: 76, approx: 1 });
  });

  it('27: valor parado nos vencidos e valor em risco do que vence no prazo, do que vence primeiro', () => {
    const r = expiryRisk(
      [
        { id: 'c', name: 'Caneca', unit: 'un', unitCost: 10, stockQuantity: 14, stockLots: lots },
        {
          id: 't',
          name: 'Tinta',
          unit: 'ml',
          unitCost: 0.5,
          stockQuantity: 10,
          stockLots: [lot('t1', 10, '2026-11-20')],
        },
      ],
      TODAY,
      30,
    );
    expect(r.expiredValue).toBe(30);
    expect(r.soon.map(x => [x.materialName, x.lot.expiresAt, x.value])).toEqual([
      ['Caneca', '2026-11-02', 20],
      ['Tinta', '2026-11-20', 5],
    ]);
    expect(r.soonValue).toBe(25);
  });

  it('hoje no formato da validade', () => {
    expect(todayISO(new Date(2026, 10, 2, 23, 59))).toBe('2026-11-02');
  });
});
