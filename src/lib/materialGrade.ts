/**
 * materialGrade.ts — matéria-prima com grade (16/11/2026). Ex.: uma "Camiseta" com tecidos, tamanhos e cores. Cada
 * combinação vira um item interno (`variantOf` = a Camiseta), escondido das listas, com o próprio saldo e lotes: reserva,
 * baixa e separação continuam funcionando como em qualquer material. O custo é por tecido e tamanho.
 */
import type { Material, MaterialGrade, Product } from '../types';
import { addToLots, stockFields } from './stockLots';
import { gradeCostKey, gradeKey, splitGradeKey } from './grade';

const num = (v: unknown) => Number(v) || 0;

export const hasMaterialGrade = (m: Pick<Partial<Material>, 'grade'> | null | undefined) => {
  const grade = m?.grade;
  return !!grade && grade.fabrics.length > 0 && grade.sizes.length > 0 && grade.colors.length > 0;
};

/** Todas as combinações da grade, na ordem das listas. */
export const gradeKeysOf = (grade: MaterialGrade) =>
  grade.fabrics.flatMap(fabric =>
    grade.sizes.flatMap(size => grade.colors.map(color => gradeKey(fabric, size, color))),
  );

/** Id fixo do item da combinação: salvar de novo não duplica. */
export const variantDocId = (parentId: string, key: string) =>
  `${parentId}__${key
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .toLowerCase()}`;

/** Itens das combinações de uma matéria-prima, na ordem tecido, tamanho, cor da grade. */
export function variantsOf(materials: Material[], parent: Pick<Material, 'id'> & Partial<Pick<Material, 'grade'>>) {
  const order = parent.grade ? gradeKeysOf(parent.grade) : [];
  const rank = (m: Material) => {
    const i = order.indexOf(m.variantKey ?? '');
    return i < 0 ? order.length : i;
  };
  return materials.filter(m => m.variantOf === parent.id).sort((a, b) => rank(a) - rank(b));
}

export const gradeStockTotal = (materials: Material[], parentId: string) =>
  materials.filter(m => m.variantOf === parentId).reduce((sum, m) => sum + num(m.stockQuantity), 0);

/** "Algodão · M · Azul" para o item da combinação. */
export function variantLabel(m: Pick<Material, 'name'> & Partial<Pick<Material, 'variantKey'>>) {
  if (!m.variantKey) return m.name;
  const { fabric, size, color } = splitGradeKey(m.variantKey);
  return `${fabric} · ${size} · ${color}`;
}

/** Custo de referência da Camiseta (o maior), para a receita do produto antes de escolher a combinação. */
export const gradeReferenceCost = (grade: MaterialGrade) => Math.max(0, ...Object.values(grade.costs).map(num));

/** Tecido e tamanho sem custo: a matéria-prima não salva até preencher. */
export const materialGradeMissingCosts = (grade: MaterialGrade) =>
  grade.fabrics.flatMap(fabric =>
    grade.sizes.filter(size => !(num(grade.costs[gradeCostKey(fabric, size)]) > 0)).map(size => `${fabric} ${size}`),
  );

/**
 * O que gravar: combinação nova vira item com saldo zero; a que já existe só muda se o custo ou o nome mudaram. O saldo
 * dos itens nunca é tocado aqui. Combinação que saiu das listas fica como está, com o saldo que tiver.
 */
export function materialGradeChanges(
  parent: { id: string; name: string; storeId: string; supplierId?: string | null; categoryIds?: string[] },
  grade: MaterialGrade,
  existing: Material[],
  now: string,
) {
  const create: Array<{ id: string; data: Record<string, string | number | boolean | object | null> }> = [];
  const update: Array<{ id: string; data: Record<string, string | number | boolean | object | null> }> = [];
  for (const key of gradeKeysOf(grade)) {
    const { fabric, size, color } = splitGradeKey(key);
    const id = variantDocId(parent.id, key);
    const cost = num(grade.costs[gradeCostKey(fabric, size)]);
    const name = [parent.name.trim(), fabric, size, color].join(' ');
    const found = existing.find(m => m.id === id);
    if (!found) {
      create.push({
        id,
        data: {
          name,
          unit: 'un',
          purchasePrice: cost,
          purchaseQuantity: 1,
          unitCost: cost,
          isPackage: false,
          packageQuantity: 1,
          supplierId: parent.supplierId || null,
          categoryIds: parent.categoryIds || [],
          storeId: parent.storeId,
          variantOf: parent.id,
          variantKey: key,
          ...stockFields(addToLots([], 0, null)),
          minStockQuantity: 0,
          createdAt: now,
        },
      });
    } else if (num(found.unitCost) !== cost || found.name !== name) {
      update.push({ id, data: { name, purchasePrice: cost, purchaseQuantity: 1, unitCost: cost, updatedAt: now } });
    }
  }
  return { create, update };
}

/** A matéria-prima com grade que está na receita do produto (a primeira, se houver mais de uma). */
export function gradeMaterialOf(product: Pick<Partial<Product>, 'materials'>, materials: Material[]) {
  for (const pm of product.materials ?? []) {
    const m = materials.find(x => x.id === pm.materialId);
    if (m && hasMaterialGrade(m)) return m;
  }
  return undefined;
}

/**
 * Item 32, entrega 2 (16/11/2026): produto com uma matéria-prima com grade na receita (ex.: Camiseta). A conta e o
 * orçamento usam a grade dela: a linha da Camiseta sai da receita e entra a combinação escolhida (custo, baixa e
 * separação), com as técnicas do produto. Produto com a grade antiga, no próprio produto, fica como está.
 */
export function withMaterialGrade<T extends Partial<Product>>(product: T, materials: Material[]): T {
  if (product.grade?.fabrics?.length) return product;
  const parent = gradeMaterialOf(product, materials);
  if (!parent?.grade) return product;
  const recipe = product.materials ?? [];
  const line = recipe.find(pm => pm.materialId === parent.id);
  const g = parent.grade;
  return {
    ...product,
    materials: recipe.filter(pm => pm.materialId !== parent.id),
    grade: {
      fabrics: g.fabrics,
      sizes: g.sizes,
      colors: g.colors,
      costs: g.costs,
      pieces: variantsOf(materials, parent)
        .filter(v => v.variantKey)
        .map(v => ({ key: v.variantKey as string, materialId: v.id, active: true })),
      techniques: product.techniques ?? [],
      pieceQuantity: num(line?.quantity) || 1,
      replacesMaterialId: parent.id,
    },
  };
}
