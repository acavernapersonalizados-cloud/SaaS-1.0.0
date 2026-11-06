/**
 * grade.ts — grade do produto (Estacionamento item 30, parte B1, 6/11/2026). Ex.: camiseta por tecido, tamanho e cor.
 * O estoque é por peça exata, e só as combinações marcadas viram material. O custo é por tecido e tamanho, igual para
 * todas as cores. No orçamento a escolha vai em `variationOptionId` ("Algodão|GG|Rosa"), com os mesmos campos da
 * variação simples (lib/variation.ts): reserva, baixa e separação não mudam.
 */
import type { Material, Product, ProductGrade, ProductGradeTechnique, QuoteItem } from '../types';

const num = (v: unknown) => Number(v) || 0;

/** "tecido|tamanho|cor" é a peça; no orçamento, a técnica escolhida vem depois: "tecido|tamanho|cor|técnica". */
export const gradeKey = (fabric: string, size: string, color: string, technique?: string) =>
  [fabric, size, color, ...(technique ? [technique] : [])].join('|');

export function splitGradeKey(key?: string | null) {
  const [fabric = '', size = '', color = '', technique = ''] = (key ?? '').split('|');
  return { fabric, size, color, technique };
}

const pieceKeyOf = (key: string) => {
  const { fabric, size, color } = splitGradeKey(key);
  return gradeKey(fabric, size, color);
};

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
  grade && key ? activePieces(grade).find(piece => piece.key === pieceKeyOf(key)) : undefined;

/** Técnicas que o tecido aceita. */
export const techniquesFor = (grade: ProductGrade, fabric: string) =>
  (grade.techniques ?? []).filter(technique => technique.fabrics.includes(fabric));

const chosenTechnique = (grade: ProductGrade, key?: string | null) => {
  const { fabric, technique } = splitGradeKey(key);
  return techniquesFor(grade, fabric).find(t => t.id === technique);
};

const techniqueCost = (technique: ProductGradeTechnique, materials: Material[]) =>
  technique.materials.reduce(
    (sum, pm) => sum + num(materials.find(m => m.id === pm.materialId)?.unitCost) * num(pm.quantity),
    0,
  );

/** Técnica da conta: a escolhida; sem escolha, a mais cara, para a referência nunca sair abaixo do custo. */
function techniqueForCost(grade: ProductGrade, materials: Material[], key?: string | null) {
  return (
    chosenTechnique(grade, key) ??
    [...(grade.techniques ?? [])].sort((a, b) => techniqueCost(b, materials) - techniqueCost(a, materials))[0]
  );
}

/** Minutos de mão de obra da técnica, somados ao tempo do produto. */
export function gradeTechniqueMinutes(
  grade: ProductGrade | null | undefined,
  materials: Material[],
  key?: string | null,
) {
  return grade ? num(techniqueForCost(grade, materials, key)?.minutes) : 0;
}

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
  const technique = techniqueForCost(grade, materials, key);
  const extra = technique ? techniqueCost(technique, materials) : 0;
  const { fabric, size } = splitGradeKey(key);
  if (key && inLists(grade, key)) {
    const stock = materials.find(m => m.id === gradePieceOf(grade, key)?.materialId);
    return (num(stock?.unitCost) || num(grade.costs[gradeCostKey(fabric, size)])) + extra;
  }
  return Math.max(0, ...Object.values(grade.costs).map(num)) + extra;
}

/** Campos do item do orçamento. Escolha incompleta: nada, e o orçamento pede para terminar. */
export function gradeItemFields(grade: ProductGrade, key?: string | null): Partial<QuoteItem> {
  if (!key || !inLists(grade, key)) return {};
  const { fabric, size, color } = splitGradeKey(key);
  const materialId = gradePieceOf(grade, key)?.materialId;
  // Sem peça e sem custo na grade, o preço sairia sem a camiseta: o orçamento trava até preencher.
  if (!materialId && !(num(grade.costs[gradeCostKey(fabric, size)]) > 0)) return {};
  // Item 30 B2: com técnica cadastrada, a escolha é obrigatória e tem de ser aceita pelo tecido.
  const technique = chosenTechnique(grade, key);
  if ((grade.techniques ?? []).length > 0 && !technique) return {};
  const supplies = (technique?.materials ?? []).filter(pm => num(pm.quantity) > 0);
  return {
    variationOptionId: key,
    variationLabel: [fabric, size, color, technique?.name].filter(Boolean).join(' · '),
    variationValue: num(technique?.additionalValue),
    // Peça sem cadastro: dá para orçar, mas não há o que baixar.
    ...(materialId ? { variationMaterialId: materialId, variationQuantity: 1 } : {}),
    ...(supplies.length > 0 ? { variationMaterials: supplies } : {}),
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

/** Tecidos sem nenhuma técnica aceita: o orçamento não teria o que escolher, então o produto não salva. */
export const gradeFabricsWithoutTechnique = (grade: ProductGrade) =>
  (grade.techniques ?? []).length > 0 ? grade.fabrics.filter(fabric => techniquesFor(grade, fabric).length === 0) : [];

/** Ao salvar: tira técnica sem nome e tecido que saiu da lista. */
export const cleanGradeTechniques = (grade: ProductGrade): ProductGrade => ({
  ...grade,
  techniques: (grade.techniques ?? [])
    .filter(technique => technique.name.trim())
    .map(technique => ({
      ...technique,
      name: technique.name.replace(/\|/g, '').trim(),
      fabrics: technique.fabrics.filter(fabric => grade.fabrics.includes(fabric)),
    })),
});

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
