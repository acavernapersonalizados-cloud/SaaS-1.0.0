// Matéria-prima com grade (16/11/2026).
import { describe, expect, it } from 'vitest';
import type { CostBase, Material, MaterialGrade, Product } from '../types';
import { calcProductCost, calcQuoteItem } from './pricingEngine';
import { itemMaterials } from './variation';
import { gradeKey } from './grade';
import {
  gradeKeysOf,
  gradeReferenceCost,
  gradeStockTotal,
  hasMaterialGrade,
  materialGradeChanges,
  materialGradeMissingCosts,
  variantDocId,
  variantLabel,
  variantsOf,
  withMaterialGrade,
} from './materialGrade';

const grade: MaterialGrade = {
  fabrics: ['Algodão', 'Dryfit'],
  sizes: ['M', 'GG'],
  colors: ['Azul', 'Preta'],
  costs: { 'Algodão|M': 20, 'Algodão|GG': 25, 'Dryfit|M': 18, 'Dryfit|GG': 30 },
};
const parent = { id: 'cam', name: ' Camiseta ', storeId: 's', categoryIds: ['c1'] };
const now = '2026-11-16T10:00:00.000Z';

describe('Matéria-prima com grade', () => {
  it('grade só vale com tecido, tamanho e cor', () => {
    expect(hasMaterialGrade({ grade })).toBe(true);
    expect(hasMaterialGrade({ grade: { ...grade, colors: [] } })).toBe(false);
    expect(hasMaterialGrade({})).toBe(false);
  });
  it('todas as combinações, na ordem tecido, tamanho, cor', () => {
    expect(gradeKeysOf(grade)).toEqual([
      'Algodão|M|Azul',
      'Algodão|M|Preta',
      'Algodão|GG|Azul',
      'Algodão|GG|Preta',
      'Dryfit|M|Azul',
      'Dryfit|M|Preta',
      'Dryfit|GG|Azul',
      'Dryfit|GG|Preta',
    ]);
  });
  it('id fixo por combinação, sem acento nem barra', () => {
    expect(variantDocId('cam', 'Algodão|M|Azul')).toBe('cam__algodao-m-azul');
    expect(variantDocId('cam', 'Baby look algodão|G/G|Azul')).toBe('cam__baby-look-algodao-g-g-azul');
  });
  it('primeira gravação cria um item por combinação, com saldo zero e o custo do tecido e tamanho', () => {
    const r = materialGradeChanges(parent, grade, [], now);
    expect(r.create).toHaveLength(8);
    expect(r.update).toEqual([]);
    expect(r.create[2]).toMatchObject({
      id: 'cam__algodao-gg-azul',
      data: {
        name: 'Camiseta Algodão GG Azul',
        unit: 'un',
        unitCost: 25,
        stockQuantity: 0,
        variantOf: 'cam',
        variantKey: 'Algodão|GG|Azul',
        categoryIds: ['c1'],
        supplierId: null,
        storeId: 's',
      },
    });
  });
  it('salvar de novo não duplica; muda só custo e nome, nunca o saldo', () => {
    const first = materialGradeChanges(parent, grade, [], now).create.map(
      c => ({ id: c.id, ...c.data, stockQuantity: 7 }) as unknown as Material,
    );
    expect(materialGradeChanges(parent, grade, first, now)).toEqual({ create: [], update: [] });
    const raised = { ...grade, costs: { ...grade.costs, 'Algodão|M': 22 } };
    const r = materialGradeChanges(parent, raised, first, now);
    expect(r.update.map(u => u.id)).toEqual(['cam__algodao-m-azul', 'cam__algodao-m-preta']);
    expect(r.update[0]?.data).not.toHaveProperty('stockQuantity');
  });
  it('cor nova cria só as combinações dela', () => {
    const first = materialGradeChanges(parent, grade, [], now).create.map(
      c => ({ id: c.id, ...c.data }) as unknown as Material,
    );
    const r = materialGradeChanges(parent, { ...grade, colors: [...grade.colors, 'Rosa'] }, first, now);
    expect(r.create.map(c => c.id)).toEqual([
      'cam__algodao-m-rosa',
      'cam__algodao-gg-rosa',
      'cam__dryfit-m-rosa',
      'cam__dryfit-gg-rosa',
    ]);
  });
  it('custo faltando trava; referência é o maior custo', () => {
    expect(materialGradeMissingCosts({ ...grade, costs: { 'Algodão|M': 20 } })).toEqual([
      'Algodão GG',
      'Dryfit M',
      'Dryfit GG',
    ]);
    expect(materialGradeMissingCosts(grade)).toEqual([]);
    expect(gradeReferenceCost(grade)).toBe(30);
  });
  it('saldo total, ordem da grade e rótulo da combinação', () => {
    const items = [
      { id: 'b', name: 'x', variantOf: 'cam', variantKey: 'Dryfit|M|Azul', stockQuantity: 2 },
      { id: 'a', name: 'y', variantOf: 'cam', variantKey: 'Algodão|M|Azul', stockQuantity: 5 },
      { id: 'z', name: 'outro', stockQuantity: 100 },
    ] as unknown as Material[];
    expect(gradeStockTotal(items, 'cam')).toBe(7);
    expect(variantsOf(items, { id: 'cam', grade }).map(m => m.id)).toEqual(['a', 'b']);
    expect(variantLabel(items[1]!)).toBe('Algodão · M · Azul');
    expect(variantLabel(items[2]!)).toBe('outro');
  });
});

describe('Entrega 2: produto usa a grade da matéria-prima', () => {
  const camiseta = { id: 'cam', name: 'Camiseta', unit: 'un', unitCost: 30, storeId: 's', grade } as unknown as Material;
  const children = materialGradeChanges(camiseta, grade, [], now).create.map(
    c => ({ id: c.id, ...c.data }) as unknown as Material,
  );
  const tinta = { id: 'tinta', name: 'Tinta', unit: 'ml', unitCost: 2 } as unknown as Material;
  const materials = [camiseta, ...children, tinta];
  const product = {
    id: 'p',
    name: 'Camiseta personalizada',
    materials: [
      { materialId: 'cam', quantity: 1 },
      { materialId: 'tinta', quantity: 1 },
    ],
    productionTime: 0,
    packagingCost: 0,
    techniques: [
      { id: 'dtf', name: 'DTF', materials: [], minutes: 0, additionalValue: 0, fabrics: ['Algodão', 'Dryfit'], perMeter: true },
      {
        id: 'sil',
        name: 'Silk',
        materials: [{ materialId: 'tinta', quantity: 1 }],
        minutes: 0,
        additionalValue: 0,
        fabrics: ['Algodão'],
        colorsByFabric: { Algodão: ['Preta'] },
      },
    ],
  } as unknown as Product;
  const costs = { hourlyRate: 0, markupPct: 100, storeId: 's' } as unknown as CostBase;
  const quote = (key: string, extra = {}) =>
    calcQuoteItem(
      { quantity: 1, selectedFinishingIds: [], selectedAccessoryIds: [], variationOptionId: key, ...extra },
      product,
      materials,
      costs,
      0,
    )!;

  it('a Camiseta sai da receita e vira a grade do produto, com as combinações e as técnicas', () => {
    const p = withMaterialGrade(product, materials);
    expect(p.materials).toEqual([{ materialId: 'tinta', quantity: 1 }]);
    expect(p.grade?.pieces).toHaveLength(8);
    expect(p.grade?.pieces[0]).toEqual({ key: 'Algodão|M|Azul', materialId: 'cam__algodao-m-azul', active: true });
    expect(p.grade?.replacesMaterialId).toBe('cam');
    expect(p.grade?.techniques).toHaveLength(2);
    expect(withMaterialGrade(p, materials)).toBe(p);
  });
  it('custo de referência sem escolha: tinta + a peça mais cara + a técnica mais cara (não soma a Camiseta)', () => {
    expect(calcProductCost(product, materials, costs).materialCost).toBe(2 + 30 + 2);
  });
  it('escolha completa: custo da combinação, baixa da combinação no lugar da Camiseta', () => {
    const r = quote(gradeKey('Algodão', 'GG', 'Preta', 'sil'));
    expect(r.variationMissing).toBe(false);
    expect(r.materialCost).toBe(2 + 25 + 2);
    expect(r.variationFields).toMatchObject({
      variationLabel: 'Algodão · GG · Preta · Silk',
      variationMaterialId: 'cam__algodao-gg-preta',
      variationQuantity: 1,
      variationReplacesMaterialId: 'cam',
    });
    expect(itemMaterials(product.materials, r.variationFields)).toEqual([
      { materialId: 'tinta', quantity: 1 },
      { materialId: 'cam__algodao-gg-preta', quantity: 1 },
      { materialId: 'tinta', quantity: 1 },
    ]);
  });
  it('técnica que o tecido ou a cor não aceita não entra', () => {
    expect(quote(gradeKey('Algodão', 'GG', 'Azul', 'sil')).variationMissing).toBe(true);
    expect(quote(gradeKey('Dryfit', 'M', 'Azul', 'sil')).variationMissing).toBe(true);
  });
  it('DTF com a tabela e a retirada', () => {
    const r = quote(gradeKey('Dryfit', 'M', 'Azul', 'dtf'), { dtfMeters: 2, dtfPrints: 40 });
    expect(r.materialCost).toBeCloseTo(2 + 18 + 136.5 / 40, 10);
  });
  it('duas camisetas por unidade: custo e baixa em dobro', () => {
    const two = { ...product, materials: [{ materialId: 'cam', quantity: 2 }] } as Product;
    const r = calcQuoteItem(
      { quantity: 1, selectedFinishingIds: [], selectedAccessoryIds: [], variationOptionId: gradeKey('Algodão', 'M', 'Azul', 'dtf'), dtfMeters: 1, dtfPrints: 1 },
      two,
      materials,
      costs,
      0,
    )!;
    expect(r.variationFields.variationQuantity).toBe(2);
    expect(r.materialCost).toBeCloseTo(40 + 76.5, 10);
  });
  it('produto com a grade antiga e produto comum ficam como estão', () => {
    const legacy = { ...product, grade: { ...grade, pieces: [] } } as unknown as Product;
    expect(withMaterialGrade(legacy, materials)).toBe(legacy);
    const plain = { ...product, materials: [{ materialId: 'tinta', quantity: 1 }] } as Product;
    expect(withMaterialGrade(plain, materials)).toBe(plain);
  });
});
