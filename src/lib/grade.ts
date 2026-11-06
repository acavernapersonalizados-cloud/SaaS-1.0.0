/**
 * grade.ts — grade do produto (Estacionamento item 30, parte B1, 6/11/2026). Ex.: camiseta por tecido, tamanho e cor.
 * O estoque é por peça exata, e só as combinações marcadas viram material. O custo é por tecido e tamanho, igual para
 * todas as cores. No orçamento a escolha vai em `variationOptionId` ("Algodão|GG|Rosa"), com os mesmos campos da
 * variação simples (lib/variation.ts): reserva, baixa e separação não mudam.
 */
import type { Material, Product, ProductGrade, QuoteItem } from '../types';

const num = (v: unknown) => Number(v) || 0;

export const gradeKey = (fabric: string, size: string, color: string) => [fabric, size, color].join('|');

export function splitGradeKey(key?: string | null) {
  const [fabric = '', size = '', color = ''] = (key ?? '').split('|');
  return { fabric, size, color };
}

export const gradeCostKey = (fabric: string, size: string) => `${fabric}|${size}`;

export const hasGrade = (product: Partial<Product> | null | undefined) => {
  const grade = product?.grade;
  return !!grade && grade.fabrics.length > 0 && grade.sizes.length > 0 && grade.colors.length > 0;
};

/** "Algodão, Dryfit" → lista sem repetidos. A barra em pé é o separador da chave, então sai do nome. */
export const parseGradeList = (text: string) => [
  ...new Set(
    text
      .split(',')
      .map(part => part.replace(/\|/g, '').trim())
      .filter(Boolean),
  ),
];

const inLists = (grade: ProductGrade, key: string) => {
  const { fabric, size, color } = splitGradeKey(key);
  return grade.fabrics.includes(fabric) && grade.sizes.includes(size) && grade.colors.includes(color);
};

/** Peças marcadas e ainda dentro das listas (tecido renomeado deixa a peça antiga de fora, sem apagar o material). */
export const activePieces = (grade: ProductGrade) =>
  grade.pieces.filter(piece => piece.active && inLists(grade, piece.key));

export const gradePieceOf = (grade: ProductGrade | null | undefined, key?: string | null) =>
  grade && key ? activePieces(grade).find(piece => piece.key === key) : undefined;

/** Marca ou desmarca. A peça desmarcada guarda o material: marcar de novo volta para o mesmo saldo. */
export function toggleGradePiece(grade: ProductGrade, key: string): ProductGrade {
  const found = grade.pieces.find(piece => piece.key === key);
  return {
    ...grade,
    pieces: found
      ? grade.pieces.map(piece => (piece.key === key ? { ...piece, active: !piece.active } : piece))
      : [...grade.pieces, { key, materialId: null, active: true }],
  };
}

/**
 * Custo da peça. Com a peça no estoque, vale o custo do material (a compra pode ter mudado); senão, o da grade. Sem
 * escolha (lista de produtos, catálogo), vale o maior custo, para a referência nunca sair abaixo do custo.
 */
export function gradeUnitCost(grade: ProductGrade | null | undefined, materials: Material[], key?: string | null) {
  if (!grade) return 0;
  const { fabric, size } = splitGradeKey(key);
  if (key && inLists(grade, key)) {
    const stock = materials.find(m => m.id === gradePieceOf(grade, key)?.materialId);
    return num(stock?.unitCost) || num(grade.costs[gradeCostKey(fabric, size)]);
  }
  return Math.max(0, ...Object.values(grade.costs).map(num));
}

/** Campos do item do orçamento. Escolha incompleta: nada, e o orçamento pede para terminar. */
export function gradeItemFields(grade: ProductGrade, key?: string | null): Partial<QuoteItem> {
  if (!key || !inLists(grade, key)) return {};
  const { fabric, size, color } = splitGradeKey(key);
  const materialId = gradePieceOf(grade, key)?.materialId;
  // Sem peça e sem custo na grade, o preço sairia sem a camiseta: o orçamento trava até preencher.
  if (!materialId && !(num(grade.costs[gradeCostKey(fabric, size)]) > 0)) return {};
  return {
    variationOptionId: key,
    variationLabel: `${fabric} · ${size} · ${color}`,
    variationValue: 0,
    // Peça sem cadastro: dá para orçar, mas não há o que baixar.
    ...(materialId ? { variationMaterialId: materialId, variationQuantity: 1 } : {}),
  };
}

/** Peças marcadas sem custo: o produto não salva até preencher. */
export const gradeMissingCosts = (grade: ProductGrade) => [
  ...new Set(
    activePieces(grade)
      .map(piece => splitGradeKey(piece.key))
      .filter(({ fabric, size }) => !(num(grade.costs[gradeCostKey(fabric, size)]) > 0))
      .map(({ fabric, size }) => `${fabric} ${size}`),
  ),
];

/**
 * O que salvar no estoque: peças novas viram material; peça cujo custo mudou na grade atualiza o material. Custo igual
 * ao que estava salvo não mexe no material, para não apagar o preço de uma compra feita depois.
 */
export function gradeStockChanges(
  grade: ProductGrade,
  productName: string,
  materials: Material[],
  saved: ProductGrade | null | undefined,
  newId: () => string,
) {
  const create: Array<{ id: string; name: string; unitCost: number }> = [];
  const update: Array<{ id: string; name: string; unitCost: number }> = [];
  const active = new Set(activePieces(grade).map(piece => piece.key));
  const pieces = grade.pieces.map(piece => {
    if (!active.has(piece.key)) return piece;
    const { fabric, size, color } = splitGradeKey(piece.key);
    const costKey = gradeCostKey(fabric, size);
    const unitCost = num(grade.costs[costKey]);
    const stock = materials.find(m => m.id === piece.materialId);
    if (stock) {
      if (saved && num(saved.costs[costKey]) !== unitCost) update.push({ id: stock.id, name: stock.name, unitCost });
      return piece;
    }
    const id = newId();
    create.push({ id, name: [productName.trim(), fabric, size, color].join(' '), unitCost });
    return { ...piece, materialId: id };
  });
  return { grade: { ...grade, pieces }, create, update };
}
