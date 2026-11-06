// Grade do produto (Estacionamento item 30, parte B1).
import { describe, expect, it } from 'vitest';
import type { CostBase, Material, Product, ProductGrade } from '../types';
import { calcProductCost, calcQuoteItem } from './pricingEngine';
import { hasVariation, itemMaterials, variationItemFields } from './variation';
import {
  activePieces,
  cleanGradeTechniques,
  gradeFabricsWithoutTechnique,
  gradeItemFields,
  gradeKey,
  gradeMissingCosts,
  gradeStockChanges,
  gradeUnitCost,
  hasGrade,
  parseGradeList,
  splitGradeKey,
  toggleGradePiece,
} from './grade';

const material = (id: string, unitCost: number) => ({ id, name: id, unit: 'un', unitCost }) as unknown as Material;
const key = gradeKey('Algodão', 'GG', 'Rosa');
const grade: ProductGrade = {
  fabrics: ['Algodão', 'Dryfit'],
  sizes: ['P', 'GG'],
  colors: ['Rosa', 'Preta'],
  costs: { 'Algodão|P': 20, 'Algodão|GG': 25, 'Dryfit|P': 18, 'Dryfit|GG': 30 },
  pieces: [
    { key, materialId: 'peca-rosa', active: true },
    { key: gradeKey('Dryfit', 'P', 'Preta'), materialId: null, active: true },
    { key: gradeKey('Algodão', 'P', 'Preta'), materialId: 'peca-off', active: false },
  ],
};
const product = {
  id: 'camiseta',
  name: 'Camiseta',
  materials: [{ materialId: 'tinta', quantity: 1 }],
  productionTime: 0,
  packagingCost: 0,
  grade,
} as unknown as Product;
const materials = [material('tinta', 2), material('peca-rosa', 25)];
const costs = { hourlyRate: 0, markupPct: 100, storeId: 's' } as unknown as CostBase;
const quote = (variationOptionId?: string) =>
  calcQuoteItem(
    { quantity: 1, selectedFinishingIds: [], selectedAccessoryIds: [], variationOptionId },
    product,
    materials,
    costs,
    0,
  )!;

describe('Item 30 B1: chave e listas', () => {
  it('chave vai e volta; lista tira repetidos, espaços e a barra em pé', () => {
    expect(splitGradeKey(key)).toEqual({ fabric: 'Algodão', size: 'GG', color: 'Rosa', technique: '' });
    expect(splitGradeKey(undefined)).toEqual({ fabric: '', size: '', color: '', technique: '' });
    expect(parseGradeList(' P, M ,P,, G|G ')).toEqual(['P', 'M', 'GG']);
  });
  it('produto só tem grade com tecido, tamanho e cor; grade conta como variação', () => {
    expect(hasGrade(product)).toBe(true);
    expect(hasVariation(product)).toBe(true);
    expect(hasGrade({ grade: { ...grade, colors: [] } })).toBe(false);
    expect(hasGrade({})).toBe(false);
  });
  it('marcar e desmarcar: a peça desmarcada guarda o material', () => {
    const off = toggleGradePiece(grade, key);
    expect(activePieces(off).map(p => p.key)).not.toContain(key);
    expect(off.pieces.find(p => p.key === key)?.materialId).toBe('peca-rosa');
    const on = toggleGradePiece(off, key);
    expect(on.pieces.find(p => p.key === key)).toEqual({ key, materialId: 'peca-rosa', active: true });
    const added = toggleGradePiece(grade, gradeKey('Dryfit', 'GG', 'Rosa'));
    expect(added.pieces).toHaveLength(4);
  });
  it('tecido tirado da lista deixa as peças dele de fora', () => {
    expect(activePieces({ ...grade, fabrics: ['Dryfit'] }).map(p => p.key)).toEqual(['Dryfit|P|Preta']);
  });
});

describe('Item 30 B1: custo e preço', () => {
  it('peça no estoque: vale o custo do material, mesmo depois de uma compra', () => {
    expect(gradeUnitCost(grade, [material('peca-rosa', 27)], key)).toBe(27);
  });
  it('peça sem cadastro: vale o custo da grade para o tecido e o tamanho', () => {
    expect(gradeUnitCost(grade, materials, gradeKey('Algodão', 'P', 'Rosa'))).toBe(20);
  });
  it('sem escolha: referência pelo maior custo, somando a receita', () => {
    expect(gradeUnitCost(grade, materials)).toBe(30);
    expect(calcProductCost(product, materials, costs).materialCost).toBe(32);
    expect(gradeUnitCost(null, materials)).toBe(0);
  });
  it('tamanho e tecido mudam o preço pelo markup', () => {
    expect(quote(key).unitPrice).toBeCloseTo(54, 10);
    expect(quote(gradeKey('Dryfit', 'P', 'Rosa')).unitPrice).toBeCloseTo(40, 10);
  });
  it('escolha incompleta: o orçamento pede para terminar', () => {
    expect(quote().variationMissing).toBe(true);
    expect(quote('Algodão||').variationMissing).toBe(true);
    expect(quote(key).variationMissing).toBe(false);
  });
});

describe('Item 30 B1: orçamento e baixa', () => {
  it('peça com material: mesmos campos da variação, com o rótulo das três escolhas', () => {
    expect(variationItemFields(product, key)).toEqual({
      variationOptionId: key,
      variationLabel: 'Algodão · GG · Rosa',
      variationValue: 0,
      variationMaterialId: 'peca-rosa',
      variationQuantity: 1,
    });
  });
  it('peça sem cadastro e sem custo na grade: não entra no orçamento (sairia sem a camiseta no preço)', () => {
    const noCost = { ...grade, costs: { 'Algodão|GG': 25 } };
    expect(gradeItemFields(noCost, gradeKey('Dryfit', 'P', 'Rosa'))).toEqual({});
    expect(gradeItemFields(noCost, key).variationOptionId).toBe(key);
  });
  it('peça sem cadastro ou desmarcada: orça, mas sem material para baixar', () => {
    expect(gradeItemFields(grade, gradeKey('Dryfit', 'GG', 'Rosa')).variationMaterialId).toBeUndefined();
    const off = gradeItemFields(grade, gradeKey('Algodão', 'P', 'Preta'));
    expect(off.variationLabel).toBe('Algodão · P · Preta');
    expect(off.variationMaterialId).toBeUndefined();
    expect(Object.values(off)).not.toContain(undefined);
  });
});

describe('Item 30 B2: técnica', () => {
  const sub = {
    id: 'sub',
    name: 'Sublimação',
    materials: [
      { materialId: 'papel', quantity: 1 },
      { materialId: 'zero', quantity: 0 },
    ],
    minutes: 6,
    additionalValue: 0,
    fabrics: ['Dryfit'],
  };
  const dtf = {
    id: 'dtf',
    name: 'DTF',
    materials: [],
    minutes: 12,
    additionalValue: 8,
    fabrics: ['Algodão', 'Dryfit'],
  };
  const withTech: ProductGrade = { ...grade, techniques: [sub, dtf] };
  const shirt = { ...product, grade: withTech, materials: [] } as unknown as Product;
  const stock = [...materials, material('papel', 3), material('zero', 100)];
  const labored = { ...costs, hourlyRate: 60 } as unknown as CostBase;
  const item = (variationOptionId?: string) =>
    calcQuoteItem(
      { quantity: 1, selectedFinishingIds: [], selectedAccessoryIds: [], variationOptionId },
      shirt,
      stock,
      labored,
      0,
    )!;
  const dryfit = gradeKey('Dryfit', 'P', 'Rosa', 'sub');

  it('chave da peça ignora a técnica: o saldo é da peça', () => {
    expect(splitGradeKey(gradeKey('Algodão', 'GG', 'Rosa', 'dtf')).technique).toBe('dtf');
    expect(gradeItemFields(withTech, gradeKey('Algodão', 'GG', 'Rosa', 'dtf')).variationMaterialId).toBe('peca-rosa');
  });
  it('obrigatória: sem técnica, ou com técnica que o tecido não aceita, o item não entra', () => {
    expect(item(key).variationMissing).toBe(true);
    expect(item(gradeKey('Algodão', 'GG', 'Rosa', 'sub')).variationMissing).toBe(true);
    expect(item(gradeKey('Algodão', 'GG', 'Rosa', 'apagada')).variationMissing).toBe(true);
    expect(item(gradeKey('Algodão', 'GG', 'Rosa', 'dtf')).variationMissing).toBe(false);
  });
  it('grade sem técnica continua como no B1', () => {
    expect(gradeItemFields(grade, key).variationOptionId).toBe(key);
    expect(gradeItemFields({ ...grade, techniques: [] }, key).variationLabel).toBe('Algodão · GG · Rosa');
  });
  it('custo: insumos e tempo com markup; valor a mais por fora', () => {
    const s = item(dryfit);
    expect(s.materialCost).toBe(21);
    expect(s.laborCost).toBeCloseTo(6, 10);
    expect(s.unitPrice).toBeCloseTo(54, 10);
    const d = item(gradeKey('Dryfit', 'P', 'Rosa', 'dtf'));
    expect(d.materialCost).toBe(18);
    expect(d.laborCost).toBeCloseTo(12, 10);
    expect(d.unitPrice).toBeCloseTo(68, 10);
    expect(d.variationValue).toBe(8);
  });
  it('sem escolha: referência pela técnica mais cara', () => {
    expect(gradeUnitCost(withTech, stock)).toBe(33);
  });
  it('item grava os insumos da técnica, sem o de quantidade zero, e o rótulo com a técnica', () => {
    const f = gradeItemFields(withTech, dryfit);
    expect(f.variationLabel).toBe('Dryfit · P · Rosa · Sublimação');
    expect(f.variationMaterials).toEqual([{ materialId: 'papel', quantity: 1 }]);
    expect('variationMaterials' in gradeItemFields(withTech, gradeKey('Dryfit', 'P', 'Rosa', 'dtf'))).toBe(false);
  });
  it('baixa: receita, peça e insumos juntos', () => {
    expect(
      itemMaterials([{ materialId: 'tinta', quantity: 2 }], {
        variationMaterialId: 'peca',
        variationQuantity: 1,
        variationMaterials: [{ materialId: 'papel', quantity: 1 }],
      }),
    ).toEqual([
      { materialId: 'tinta', quantity: 2 },
      { materialId: 'peca', quantity: 1 },
      { materialId: 'papel', quantity: 1 },
    ]);
    expect(itemMaterials([], { variationMaterials: [{ materialId: 'papel', quantity: 1 }] })).toHaveLength(1);
  });
  it('tecido sem técnica trava o salvar; técnica sem nome e tecido que saiu são limpos', () => {
    expect(gradeFabricsWithoutTechnique({ ...withTech, techniques: [sub] })).toEqual(['Algodão']);
    expect(gradeFabricsWithoutTechnique(withTech)).toEqual([]);
    expect(gradeFabricsWithoutTechnique(grade)).toEqual([]);
    const clean = cleanGradeTechniques({
      ...withTech,
      fabrics: ['Dryfit'],
      techniques: [
        { ...dtf, name: ' D|TF ' },
        { ...sub, name: ' ' },
      ],
    });
    expect(clean.techniques).toEqual([{ ...dtf, name: 'DTF', fabrics: ['Dryfit'] }]);
  });
});

describe('Item 30 B1: peças no estoque', () => {
  const ids = () => {
    let n = 0;
    return () => `novo-${++n}`;
  };
  it('peça marcada sem material vira material; a já cadastrada fica', () => {
    const r = gradeStockChanges(grade, ' Camiseta ', materials, grade, ids());
    expect(r.create).toEqual([{ id: 'novo-1', name: 'Camiseta Dryfit P Preta', unitCost: 18 }]);
    expect(r.update).toEqual([]);
    expect(r.grade.pieces.find(p => p.key === 'Dryfit|P|Preta')?.materialId).toBe('novo-1');
  });
  it('peça desmarcada não cria material', () => {
    const r = gradeStockChanges(grade, 'Camiseta', [], grade, ids());
    expect(r.create.map(c => c.name)).not.toContain('Camiseta Algodão P Preta');
  });
  it('custo mudou na grade: atualiza o material; custo igual não mexe (preserva a compra)', () => {
    const changed = { ...grade, costs: { ...grade.costs, 'Algodão|GG': 28 } };
    const r = gradeStockChanges(changed, 'Camiseta', materials, grade, ids());
    expect(r.update).toEqual([{ id: 'peca-rosa', name: 'peca-rosa', unitCost: 28 }]);
    expect(gradeStockChanges(grade, 'Camiseta', [material('peca-rosa', 40)], grade, ids()).update).toEqual([]);
  });
  it('material apagado: a peça marcada é criada de novo', () => {
    const r = gradeStockChanges(grade, 'Camiseta', [], grade, ids());
    expect(r.create.map(c => c.name)).toContain('Camiseta Algodão GG Rosa');
  });
  it('peça marcada sem custo trava o salvar, uma vez por tecido e tamanho', () => {
    const noCost = { ...grade, costs: { 'Algodão|GG': 25 } };
    expect(gradeMissingCosts(noCost)).toEqual(['Dryfit P']);
    expect(gradeMissingCosts(grade)).toEqual([]);
  });
});
