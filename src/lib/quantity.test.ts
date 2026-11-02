// Estacionamento item 25: quantidade com fração (vírgula ou ponto) e kg ↔ g.
import { describe, expect, it } from 'vitest';
import { bigQuantityQuestion, equivalentText, formatQuantity, parseQuantity, subUnitOf } from './quantity';
import { addToLots, changeLotExpiry, stockFields, takeFromLots } from './stockLots';

describe('quantidade com fração', () => {
  it('vírgula ou ponto: 0,5 / 0.5 / 0,125 / 1.5 / 1.000,5 / 1.000.000', () => {
    expect(parseQuantity('0,5')).toBe(0.5);
    expect(parseQuantity('0.5')).toBe(0.5);
    expect(parseQuantity('0,125')).toBe(0.125);
    expect(parseQuantity(' 1.5 ')).toBe(1.5);
    expect(parseQuantity('1.000,5')).toBe(1000.5);
    expect(parseQuantity('1.000.000')).toBe(1000000);
    expect(parseQuantity('1.000')).toBe(1000);
    expect(parseQuantity('1.500')).toBe(1500);
    expect(parseQuantity('0.125')).toBe(0.125);
    expect(parseQuantity('1.25')).toBe(1.25);
    expect(parseQuantity(formatQuantity(2000, { grouping: false }))).toBe(2000);
    expect(parseQuantity(formatQuantity(0.125, { grouping: false }))).toBe(0.125);
    expect(parseQuantity(',5')).toBe(0.5);
    expect(parseQuantity('2,')).toBe(2);
  });

  it('vazio, texto ou negativo → null', () => {
    for (const t of ['', '  ', 'abc', '-1', '1,2,3', '1e3']) expect(parseQuantity(t)).toBeNull();
  });

  it('kg ↔ g, l ↔ ml, m ↔ cm; un sem unidade menor', () => {
    expect(subUnitOf('kg')).toEqual({ unit: 'g', factor: 1000 });
    expect(subUnitOf('L')).toEqual({ unit: 'ml', factor: 1000 });
    expect(subUnitOf('m')).toEqual({ unit: 'cm', factor: 100 });
    expect(subUnitOf('un')).toBeNull();
    expect(equivalentText(0.5, 'kg')).toBe('0,5 kg = 500 g');
    expect(equivalentText(0.12, 'kg')).toBe('0,12 kg = 120 g');
    expect(equivalentText(3, 'un')).toBe('');
    expect(formatQuantity(1 - 0.5)).toBe('0,5');
  });

  it('casos do item 25: 1 kg − 500 g = 0,5 kg; entrada de 0,25 kg; 0,75 kg dividido; 120 g = 0,12 kg; nunca negativo', () => {
    const today = '2026-11-02';
    const um = [{ id: 'a', quantity: 1, expiresAt: null, createdAt: '' }];
    const g500 = parseQuantity('500')! / subUnitOf('kg')!.factor; // digitado em g
    const menos = takeFromLots(um, g500, today);
    expect(stockFields(menos.lots).stockQuantity).toBe(0.5);
    expect(stockFields(addToLots(menos.lots, parseQuantity('0,25')!, null)).stockQuantity).toBe(0.75);
    const lote = [{ id: 'b', quantity: 0.75, expiresAt: null, createdAt: '' }];
    const div = changeLotExpiry(lote, 'b', parseQuantity('0.25')!, '2027-01-31');
    expect('lots' in div && div.lots.map(l => [l.quantity, l.expiresAt])).toEqual([
      [0.5, null],
      [0.25, '2027-01-31'],
    ]);
    expect(parseQuantity('120')! / 1000).toBe(0.12);
    expect(takeFromLots(um, 1.5, today).missing).toBe(0.5);
  });

  it('trava: 100 ou mais em kg, l ou m pede confirmação com o equivalente', () => {
    expect(bigQuantityQuestion(500, 'kg')).toBe('500 kg = 500.000 g, confirma?');
    expect(bigQuantityQuestion(180, 'm')).toBe('180 m = 18.000 cm, confirma?');
    expect(bigQuantityQuestion(99.9, 'kg')).toBeNull();
    expect(bigQuantityQuestion(500, 'g')).toBeNull();
    expect(bigQuantityQuestion(500, 'un')).toBeNull();
  });
});
