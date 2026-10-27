// Estacionamento item 14: grafias da auditoria de 27/10/2026 (T&N e A Caverna), só como exemplo de teste.
import { describe, expect, it } from 'vitest';
import type { Category, Product } from '../types';
import {
  buildCategoryGroups,
  categoryKey,
  pendingCategoryGroups,
  planCategoryUnification,
  splitCategoryText,
} from './categoryAudit';

const cat = (id: string, name: string) => ({ id, name, storeId: 'l', scope: 'product', createdAt: '' }) as Category;
const prod = (id: string, category: string, categoryIds: string[] = []) =>
  ({ id, storeId: 'l', name: id, category, categoryIds }) as unknown as Product;

const officials = [
  cat('presente', 'Presente'),
  cat('cesta', 'Cesta'),
  cat('vest', 'Vestuário'),
  cat('pap', 'Papelaria'),
];

describe('categoryKey: grafias que são a mesma', () => {
  it('maiúscula, acento, espaço no fim e plural', () => {
    for (const t of ['Presente', 'presente', 'Presente ', 'presente ', 'Presentes'])
      expect(categoryKey(t)).toBe('presente');
    for (const t of ['Vestuário', 'VESTUÁRIO', 'VESTUARIO', 'VEstuário']) expect(categoryKey(t)).toBe('vestuario');
    expect(categoryKey('cesta')).toBe(categoryKey('Cesta'));
  });
  it('"Presente, cesta" são duas categorias', () =>
    expect(splitCategoryText('Presente, cesta')).toEqual(['Presente', 'cesta']));
});

describe('buildCategoryGroups', () => {
  const products = [
    prod('a', 'Presente'),
    prod('b', 'presente '),
    prod('c', 'Presenta'),
    prod('d', 'VESTUARIO'),
    prod('e', 'Papelaria Personalizada'),
    prod('f', 'Decoração'),
    prod('g', '60'),
    prod('h', 'Presente, cesta'),
  ];
  const groups = buildCategoryGroups(products, officials);
  const byKey = (k: string) => groups.find(g => g.key === k)!;

  it('junta as grafias e conta os produtos', () => {
    expect(byKey('presente').productIds.sort()).toEqual(['a', 'b', 'h']);
    expect(byKey('presente').spellings).toEqual([
      { text: 'Presente', count: 2 },
      { text: 'presente', count: 1 },
    ]);
  });
  it('sugere a oficial: igual, começando com ela ou com 1 letra de diferença', () => {
    expect(byKey('presente').suggestedCategoryId).toBe('presente');
    expect(byKey('vestuario').suggestedCategoryId).toBe('vest');
    expect(byKey('papelaria personalizada').suggestedCategoryId).toBe('pap');
    expect(byKey('presenta').suggestedCategoryId).toBe('presente');
    expect(byKey('cesta').suggestedCategoryId).toBe('cesta');
  });
  it('sem oficial parecida: nenhuma sugestão (vira categoria nova ou fica para você decidir)', () => {
    expect(byKey('decoracao').suggestedCategoryId).toBeNull();
    expect(byKey('decoracao').suggestedName).toBe('Decoração');
    expect(byKey('60').suggestedCategoryId).toBeNull();
  });
});

describe('pendingCategoryGroups', () => {
  it('depois de organizado, o grupo sai da lista; sem oficial parecida, continua', () => {
    const products = [prod('a', 'Presente', ['presente']), prod('b', 'presente '), prod('g', '60')];
    expect(
      pendingCategoryGroups(products, officials)
        .map(g => g.key)
        .sort(),
    ).toEqual(['60', 'presente']);
    const done = [prod('a', 'Presente', ['presente']), prod('b', 'Presente', ['presente'])];
    expect(pendingCategoryGroups(done, officials)).toEqual([]);
  });
});

describe('planCategoryUnification', () => {
  it('põe a oficial no produto e troca o texto pelo nome oficial; sem escolha, não mexe', () => {
    const products = [prod('a', 'presente '), prod('g', '60'), prod('h', 'Presente, cesta'), prod('x', '')];
    const plan = planCategoryUnification(products, { presente: 'presente', cesta: 'cesta' }, officials);
    expect(plan).toEqual([
      { productId: 'a', categoryIds: ['presente'], category: 'Presente' },
      { productId: 'h', categoryIds: ['presente', 'cesta'], category: 'Presente, Cesta' },
    ]);
  });
  it('o que ficou sem escolha continua no texto', () => {
    const plan = planCategoryUnification([prod('m', 'Presente, 60')], { presente: 'presente' }, officials);
    expect(plan).toEqual([{ productId: 'm', categoryIds: ['presente'], category: 'Presente, 60' }]);
  });
  it('produto já organizado não entra no plano (rodar duas vezes não grava de novo)', () => {
    const plan = planCategoryUnification([prod('a', 'Presente', ['presente'])], { presente: 'presente' }, officials);
    expect(plan).toEqual([]);
  });
  it('mantém as oficiais que o produto já tinha', () => {
    const plan = planCategoryUnification([prod('a', 'cesta', ['presente'])], { cesta: 'cesta' }, officials);
    expect(plan).toEqual([{ productId: 'a', categoryIds: ['presente', 'cesta'], category: 'Presente, Cesta' }]);
  });
});
