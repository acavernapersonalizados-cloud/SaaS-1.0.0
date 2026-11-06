// Variação do produto (Estacionamento item 30, parte A).
import { describe, expect, it } from 'vitest';
import type { CostBase, Material, Product } from '../types';
import { calcProductCost, calcProductPricing, calcQuoteItem } from './pricingEngine';
import { buildPickList } from './pickList';
import { cleanVariation, hasVariation, itemMaterials, variationItemFields, variationMaterialCost } from './variation';

const material = (id: string, unitCost: number, stockQuantity = 10) =>
  ({ id, name: id, unit: 'un', unitCost, stockQuantity }) as unknown as Material;
const materials = [material('tinta', 1), material('azul', 10), material('rosa', 12)];
const costs = { hourlyRate: 0, markupPct: 100, storeId: 's' } as unknown as CostBase;

const plain = {
  id: 'caneca',
  name: 'Caneca Colorida',
  materials: [{ materialId: 'tinta', quantity: 2 }],
  productionTime: 0,
  packagingCost: 0,
} as unknown as Product;
const product: Product = {
  ...plain,
  variation: {
    name: 'Cor',
    quantity: 1,
    options: [
      { id: 'a', name: 'Azul', materialId: 'azul', additionalValue: 0 },
      { id: 'r', name: 'Rosa', materialId: 'rosa', additionalValue: 5 },
      { id: 's', name: 'Sem caneca', materialId: null, additionalValue: 0 },
    ],
  },
};
const quote = (p: Product, variationOptionId?: string, extra = {}) =>
  calcQuoteItem(
    { quantity: 2, selectedFinishingIds: [], selectedAccessoryIds: [], variationOptionId, ...extra },
    p,
    materials,
    costs,
    0,
  )!;

describe('Item 30: custo e preço', () => {
  it('produto sem variação: tudo igual, sem campos novos no item', () => {
    const r = quote(plain);
    expect(calcProductCost(plain, materials, costs).materialCost).toBe(2);
    expect(r.variationFields).toEqual({});
    expect(r.variationMissing).toBe(false);
    expect(r.unitPrice).toBeCloseTo(4, 10);
  });
  it('opção escolhida: o material dela soma no custo e entra no preço pelo markup', () => {
    const r = quote(product, 'a');
    expect(r.materialCost).toBe(12);
    expect(r.unitPrice).toBeCloseTo(24, 10);
    expect(r.variationMissing).toBe(false);
  });
  it('valor a mais: soma ao preço como acabamento, sem markup', () => {
    const r = quote(product, 'r');
    expect(r.materialCost).toBe(14);
    expect(r.unitPrice).toBeCloseTo(33, 10);
    expect(r.variationValue).toBe(5);
    expect(r.totalPrice).toBeCloseTo(66, 10);
  });
  it('sem escolha: referência pela opção mais cara e o item avisa que falta escolher', () => {
    expect(calcProductCost(product, materials, costs).materialCost).toBe(14);
    expect(calcProductPricing(product, materials, costs).suggestedPrice).toBeCloseTo(28, 10);
    expect(quote(product).variationMissing).toBe(true);
    expect(quote(product, 'apagada').variationMissing).toBe(true);
  });
  it('preço manual é o final: não soma o valor a mais', () => {
    const r = quote(product, 'r', { manualUnitPrice: 50 });
    expect(r.unitPrice).toBe(50);
    expect(r.variationValue).toBe(0);
    expect(r.suggestedUnitPrice).toBeCloseTo(33, 10);
  });
  it('quantidade por unidade multiplica o custo do material', () => {
    const v = { ...product.variation!, quantity: 0.5 };
    expect(variationMaterialCost(v, materials, 'a')).toBe(5);
  });
  it('material apagado do estoque não quebra a conta', () => {
    expect(variationMaterialCost(product.variation, [], 'a')).toBe(0);
    expect(variationMaterialCost(null, materials)).toBe(0);
  });
});

describe('Item 30: o orçamento guarda a escolha', () => {
  it('campos do item: rótulo, material e quantidade', () => {
    expect(variationItemFields(product, 'r')).toEqual({
      variationOptionId: 'r',
      variationLabel: 'Cor: Rosa',
      variationValue: 5,
      variationMaterialId: 'rosa',
      variationQuantity: 1,
    });
  });
  it('opção sem material: não grava campo vazio (o banco recusa undefined)', () => {
    expect(variationItemFields(product, 's')).toEqual({
      variationOptionId: 's',
      variationLabel: 'Cor: Sem caneca',
      variationValue: 0,
    });
  });
  it('baixa: receita mais o material gravado; orçamento antigo fica só com a receita', () => {
    const recipe = [{ materialId: 'tinta', quantity: 2 }];
    expect(itemMaterials(recipe, { variationMaterialId: 'azul', variationQuantity: 1 })).toEqual([
      ...recipe,
      { materialId: 'azul', quantity: 1 },
    ]);
    expect(itemMaterials(recipe, {})).toBe(recipe);
    expect(itemMaterials(undefined, {})).toEqual([]);
  });
  it('lista de separação: pega a caneca escolhida, mesmo se o produto mudar depois', () => {
    const changed = { ...product, variation: null };
    const list = buildPickList(
      [
        {
          productId: 'caneca',
          quantity: 3,
          variationMaterialId: 'azul',
          variationQuantity: 1,
          variationLabel: 'Cor: Azul',
        },
      ],
      [changed],
      materials,
    );
    const azul = list.lines.find(l => l.key === 'm:azul');
    expect(azul?.quantity).toBe(3);
    expect(azul?.from[0]).toContain('Cor: Azul');
    expect(list.lines.find(l => l.key === 'm:rosa')).toBeUndefined();
  });
  it('produto sem receita: a separação lista a caneca, não o produto', () => {
    const list = buildPickList(
      [{ productId: 'caneca', quantity: 1, variationMaterialId: 'azul', variationQuantity: 1 }],
      [{ ...product, materials: [] }],
      materials,
    );
    expect(list.lines.map(l => l.key)).toEqual(['m:azul']);
  });
});

describe('Item 30: cadastro', () => {
  it('ao salvar, tira opção sem nome; sem opções, fica sem variação', () => {
    const base = { name: ' Cor ', quantity: 0, options: [] };
    const azul = { id: 'a', name: ' Azul ', materialId: null, additionalValue: 0 };
    expect(cleanVariation({ ...base, options: [azul, { ...azul, id: 'b', name: ' ' }] })).toEqual({
      name: 'Cor',
      quantity: 1,
      options: [{ ...azul, name: 'Azul' }],
    });
    expect(cleanVariation(base)).toBeNull();
    expect(cleanVariation(null)).toBeNull();
    expect(hasVariation(plain)).toBe(false);
    expect(hasVariation(product)).toBe(true);
  });
});
