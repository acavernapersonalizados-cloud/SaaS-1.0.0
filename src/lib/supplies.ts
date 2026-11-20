/**
 * supplies.ts — outros insumos nas calculadoras de Laser, 3D e Sublimação (19/11/2026). Ex.: argola e tag NFC no
 * chaveiro. Quantidade por peça, do estoque: entram no custo (com o markup) e na receita do produto criado do trabalho,
 * que faz a baixa na venda.
 */
import type { Material, ProductMaterial } from '../types';

const num = (v: unknown) => Number(v) || 0;

/** Custo dos insumos de uma peça: custo unitário de cada um × a quantidade. Material apagado conta 0. */
export const extraSuppliesCost = (lines: ProductMaterial[] | undefined, materials: Material[]) =>
  (lines ?? []).reduce(
    (sum, line) => sum + num(materials.find(m => m.id === line.materialId)?.unitCost) * num(line.quantity),
    0,
  );

/** Ao salvar o trabalho: só as linhas com quantidade. */
export const cleanSupplies = (lines: ProductMaterial[] | undefined) =>
  (lines ?? []).filter(line => line.materialId && num(line.quantity) > 0);
