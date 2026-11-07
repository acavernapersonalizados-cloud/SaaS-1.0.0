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

describe('Correção de 6/11: preço manual do produto no orçamento', () => {
  const manual = { ...plain, manualPrice: 30 } as Product;
  const fee = (p: Product, pct: number, fixed = 0, extra = {}) =>
    calcQuoteItem(
      { quantity: 2, selectedFinishingIds: [], selectedAccessoryIds: [], ...extra },
      p,
      materials,
      costs,
      pct,
      fixed,
    )!;

  it('venda direta: vale o manual, não o sugerido', () => {
    const r = fee(manual, 0);
    expect(r.unitPrice).toBe(30);
    expect(r.productManualPrice).toBe(30);
    expect(r.itemProfit).toBeCloseTo(56, 10);
    expect(r.markup).toBeCloseTo(1400, 10);
  });
  it('canal com taxa: as taxas somam por cima e o lucro fica o mesmo', () => {
    const r = fee(manual, 20, 4);
    expect(r.unitPrice).toBeCloseTo(42.5, 10);
    expect(r.itemProfit).toBeCloseTo(56, 10);
  });
  it('sem preço manual: a conta de sempre', () => {
    expect(fee(plain, 0).unitPrice).toBeCloseTo(4, 10);
    expect(fee(plain, 0).productManualPrice).toBeNull();
  });
  it('markup e preço manual do item mandam sobre o do produto', () => {
    expect(fee(manual, 0, 0, { customMarkup: 50 }).unitPrice).toBeCloseTo(3, 10);
    expect(fee(manual, 0, 0, { manualUnitPrice: 18 }).unitPrice).toBe(18);
  });
  it('com variação: o preço é o manual mais o valor a mais; a margem muda com a opção', () => {
    const p = { ...product, manualPrice: 30 } as Product;
    const r = fee(p, 0, 0, { variationOptionId: 'r' });
    expect(r.unitPrice).toBe(35);
    expect(r.productionCost).toBe(14);
    expect(fee(p, 0, 0, { variationOptionId: 'a' }).productionCost).toBe(12);
  });
  it('manual abaixo do custo aparece como prejuízo', () => {
    expect(fee({ ...plain, manualPrice: 1 } as Product, 0).belowCost).toBe(true);
  });
});

describe('Correção de 6/11: variação em produto da calculadora', () => {
  const job = {
    ...plain,
    jobCostUnit: 20,
    materials: [{ materialId: 'tinta', quantity: 2 }],
    variation: { ...product.variation!, quantity: 2, replacesMaterialId: 'tinta' },
  } as Product;
  it('custo do trabalho mais a diferença entre a opção e o material trocado', () => {
    expect(calcProductCost(job, materials, costs, 'a').totalCost).toBe(38);
    expect(calcProductCost(job, materials, costs).totalCost).toBe(20);
  });
  it('sem material trocado, o custo do trabalho não muda de referência', () => {
    expect(calcProductCost({ ...job, variation: null }, materials, costs).totalCost).toBe(20);
  });
  it('baixa troca o material: não sai caneca-base junto', () => {
    const fields = variationItemFields(job, 'a');
    expect(fields.variationReplacesMaterialId).toBe('tinta');
    expect(itemMaterials(job.materials, fields)).toEqual([{ materialId: 'azul', quantity: 2 }]);
  });
  it('opção sem material não troca nada', () => {
    const fields = variationItemFields(job, 's');
    expect(fields.variationReplacesMaterialId).toBeUndefined();
    expect(itemMaterials(job.materials, fields)).toEqual(job.materials);
  });
  it('produto normal com troca: custo sai pela diferença', () => {
    const p = { ...job, jobCostUnit: 0 } as Product;
    expect(calcProductCost(p, materials, costs, 'a').materialCost).toBe(20);
  });
});

describe('Correção de 6/11: opção sem nome não some', () => {
  const v = { name: 'Cor', quantity: 1, options: [{ id: 'a', name: ' ', materialId: 'azul', additionalValue: 0 }] };
  it('usa o nome do material', () => {
    expect(cleanVariation(v, materials)?.options[0]?.name).toBe('azul');
  });
  it('sem nome e sem material, sai', () => {
    expect(cleanVariation({ ...v, options: [{ ...v.options[0]!, materialId: null }] }, materials)).toBeNull();
  });
  it('guarda o material trocado só quando há', () => {
    expect(cleanVariation({ ...v, replacesMaterialId: 'tinta' }, materials)?.replacesMaterialId).toBe('tinta');
    expect('replacesMaterialId' in cleanVariation(v, materials)!).toBe(false);
  });
});
