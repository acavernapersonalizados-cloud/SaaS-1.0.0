// Estacionamento item 22: lista de separação (insumos somados × quantidade, kits abertos, lote a pegar).
import { describe, expect, it } from 'vitest';
import type { Material, Product } from '../types';
import { buildCestaPickList, buildPickList } from './pickList';

const TODAY = '2026-11-02';
const mat = (id: string, name: string, unit: string, stockQuantity: number, stockLots?: Material['stockLots']) =>
  ({ id, name, unit, stockQuantity, stockLots, createdAt: '' }) as unknown as Material;
const prod = (id: string, name: string, extra: Partial<Product>) => ({ id, name, ...extra }) as unknown as Product;

const materials = [
  mat('caneca', 'Caneca Branca', 'un', 10, [
    { id: 'a', quantity: 3, expiresAt: '2026-11-20', createdAt: '' },
    { id: 'b', quantity: 7, expiresAt: null, createdAt: '' },
  ]),
  mat('pla', 'PLA Dourado', 'kg', 0.5),
  mat('fita', 'Fita', 'm', 0),
];
const products = [
  prod('p-caneca', 'Caneca Personalizada', {
    materials: [
      { materialId: 'caneca', quantity: 1 },
      { materialId: 'fita', quantity: 0.5 },
    ],
  }),
  prod('p-chaveiro', 'Chaveiro 3D', { materials: [{ materialId: 'pla', quantity: 0.012 }] }),
  prod('p-pronto', 'Cartão pronto', { materials: [] }),
  prod('kit', 'Kit Café', {
    kitItems: [
      { productId: 'p-caneca', quantity: 2 },
      { productId: 'p-chaveiro', quantity: 1 },
    ],
  }),
];

describe('lista de separação', () => {
  it('soma os insumos × quantidade e abre o kit nos seus produtos', () => {
    const r = buildPickList(
      [
        { productId: 'p-caneca', productName: 'Caneca Personalizada', quantity: 2 },
        { productId: 'kit', productName: 'Kit Café', quantity: 1 },
        { productId: 'p-pronto', productName: 'Cartão pronto', quantity: 3 },
      ],
      products,
      materials,
      { today: TODAY },
    );
    expect(r.lines.map(l => [l.name, l.quantity, l.unit])).toEqual([
      ['Caneca Branca', 4, 'un'],
      ['Fita', 2, 'm'],
      ['PLA Dourado', 0.012, 'kg'],
      ['Cartão pronto', 3, 'un'],
    ]);
    expect(r.lines[0].from).toEqual(['Caneca Personalizada × 2', 'Kit Café → Caneca Personalizada × 2']);
  });

  it('lote a pegar: o não vencido que vence primeiro; o que falta aparece', () => {
    const r = buildPickList([{ productId: 'p-caneca', quantity: 4 }], products, materials, { today: TODAY });
    const caneca = r.lines.find(l => l.name === 'Caneca Branca')!;
    expect(caneca.lots).toEqual([
      { expiresAt: '2026-11-20', quantity: 3 },
      { expiresAt: null, quantity: 1 },
    ]);
    expect(r.lines.find(l => l.name === 'Fita')!.short).toBe(2);
  });

  it('usa os lotes da reserva quando a quantidade bate; avisa quando a receita mudou', () => {
    const reservation = [
      { materialId: 'caneca', materialName: 'Caneca Branca', quantity: 2, lots: [{ expiresAt: null, quantity: 2 }] },
      { materialId: 'fita', materialName: 'Fita', quantity: 3 },
    ];
    const r = buildPickList([{ productId: 'p-caneca', quantity: 2 }], products, materials, {
      reservation,
      today: TODAY,
    });
    expect(r.lines.find(l => l.name === 'Caneca Branca')!.lots).toEqual([{ expiresAt: null, quantity: 2 }]);
    expect(r.warnings).toEqual(['Fita: a reserva tem 3 m e a receita de hoje pede 1 m.']);
  });

  it('produto apagado e kit dentro de kit viram aviso', () => {
    const nested = [...products, prod('kit2', 'Kit Grande', { kitItems: [{ productId: 'kit', quantity: 1 }] })];
    const r = buildPickList(
      [
        { productId: 'sumiu', productName: 'Produto Antigo', quantity: 1 },
        { productId: 'kit2', productName: 'Kit Grande', quantity: 1 },
      ],
      nested,
      materials,
      { today: TODAY },
    );
    expect(r.warnings).toEqual([
      'Produto não encontrado: Produto Antigo (apagado?). Separe pelo nome.',
      'Kit Grande: "Kit Café" é outro kit e fica de fora (kit não entra em kit).',
    ]);
    expect(r.lines.map(l => l.name)).toEqual(['Produto Antigo']);
  });

  it('cesta: itens ligados à matéria-prima têm lote; os digitados, só o nome', () => {
    const r = buildCestaPickList(
      [
        { id: 'i1', name: 'Caneca', quantity: 1, materialId: 'caneca', unit: 'un' },
        { id: 'i2', name: 'Café 250 g', quantity: 2 },
      ],
      materials,
      TODAY,
    );
    expect(r.lines.map(l => [l.name, l.quantity, l.lots.length])).toEqual([
      ['Caneca Branca', 1, 1],
      ['Café 250 g', 2, 0],
    ]);
  });
});
