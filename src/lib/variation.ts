/**
 * variation.ts — variação do produto (Estacionamento item 30, parte A, 5/11/2026). Ex.: "Caneca Colorida" com "Cor:
 * Azul". Cada opção pode apontar para um material do estoque, que soma à receita do produto, e ter um valor a mais. O
 * orçamento guarda a escolha, para que mudar o produto depois não mude o que já foi vendido.
 */
import type { Material, Product, ProductMaterial, ProductVariation, QuoteItem } from '../types';

const num = (v: unknown) => Number(v) || 0;

export const hasVariation = (product: Partial<Product> | null | undefined) =>
  (product?.variation?.options?.length ?? 0) > 0;

export const variationOptionOf = (variation: ProductVariation | null | undefined, optionId?: string | null) =>
  optionId ? variation?.options?.find(option => option.id === optionId) : undefined;

/**
 * Custo do material da opção escolhida. Sem escolha (lista de produtos, catálogo), vale a opção mais cara, para o preço
 * de referência nunca sair abaixo do custo.
 */
export function variationMaterialCost(
  variation: ProductVariation | null | undefined,
  materials: Material[],
  optionId?: string | null,
) {
  const costOf = (materialId: string | null | undefined) =>
    num(materials.find(m => m.id === materialId)?.unitCost) * num(variation?.quantity);
  const chosen = variationOptionOf(variation, optionId);
  if (chosen) return costOf(chosen.materialId);
  return Math.max(0, ...(variation?.options ?? []).map(option => costOf(option.materialId)));
}

/** Campos gravados no item do orçamento. Sem variação, nada: o item fica igual aos de antes. */
export function variationItemFields(product: Partial<Product>, optionId?: string | null): Partial<QuoteItem> {
  const option = variationOptionOf(product.variation, optionId);
  if (!option) return {};
  return {
    variationOptionId: option.id,
    variationLabel: `${product.variation?.name || 'Variação'}: ${option.name}`,
    variationValue: num(option.additionalValue),
    ...(option.materialId
      ? { variationMaterialId: option.materialId, variationQuantity: num(product.variation?.quantity) }
      : {}),
  };
}

/** Receita do item: a do produto mais o material da variação gravada no orçamento (reserva, baixa e separação). */
export function itemMaterials(
  recipe: ProductMaterial[] | undefined,
  item: Pick<Partial<QuoteItem>, 'variationMaterialId' | 'variationQuantity'>,
): ProductMaterial[] {
  const base = recipe ?? [];
  return item.variationMaterialId
    ? [...base, { materialId: item.variationMaterialId, quantity: num(item.variationQuantity) }]
    : base;
}

/** Na hora de salvar: tira opção sem nome; sem nenhuma opção, o produto fica sem variação. */
export function cleanVariation(variation: ProductVariation | null | undefined): ProductVariation | null {
  const options = (variation?.options ?? []).filter(option => option.name.trim());
  if (!variation || options.length === 0) return null;
  return {
    name: variation.name.trim() || 'Variação',
    quantity: num(variation.quantity) || 1,
    options: options.map(option => ({ ...option, name: option.name.trim() })),
  };
}
