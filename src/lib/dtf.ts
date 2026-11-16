/**
 * dtf.ts — custo do DTF terceirizado (Estacionamento item 30, parte B3). O fornecedor cobra por metro, com preço por
 * faixa; a pessoa informa a metragem do arquivo e quantas estampas ele tem, e o custo vira "por peça".
 */
import type { CostBase, DtfTable } from '../types';

/** Tabela do fornecedor em 6/11/2026 (Pix). Vale enquanto a loja não salva a dela na Base de Custos. */
export const DEFAULT_DTF_TABLE: DtfTable = {
  halfMeter: 30,
  tiers: [
    { minMeters: 1, pricePerMeter: 60 },
    { minMeters: 6, pricePerMeter: 50 },
    { minMeters: 51, pricePerMeter: 45 },
    { minMeters: 101, pricePerMeter: 38 },
  ],
  // 16/11/2026: zona azul e combustível de cada ida ao fornecedor.
  parkingCost: 6.5,
  fuelCost: 10,
};

/** Limite do arquivo no fornecedor (250 cm): acima disso, é preciso separar. Só avisa; a conta não muda. */
export const DTF_FILE_LIMIT_METERS = 2.5;

/** Tabela salva da loja; a retirada que ela ainda não tiver vem do padrão. */
export function dtfTableOf(costs: Pick<CostBase, 'dtfTable'> | null | undefined): DtfTable {
  const saved = costs?.dtfTable;
  if (!saved?.tiers?.length) return DEFAULT_DTF_TABLE;
  return {
    ...saved,
    parkingCost: saved.parkingCost ?? DEFAULT_DTF_TABLE.parkingCost,
    fuelCost: saved.fuelCost ?? DEFAULT_DTF_TABLE.fuelCost,
  };
}

/**
 * Custo da retirada (zona azul + combustível) que cabe a um arquivo. Buscando vários arquivos na mesma ida, divide
 * entre eles: a retirada é da viagem, não da camiseta.
 */
export const dtfTripCost = (table: DtfTable, filesPerTrip?: number | null) =>
  ((Number(table.parkingCost) || 0) + (Number(table.fuelCost) || 0)) / Math.max(1, Math.floor(Number(filesPerTrip) || 1));

/** O fornecedor vende meio metro ou metros inteiros: arredonda para cima, nunca abaixo do que se paga. */
export function dtfBilledMeters(meters: number) {
  const m = Number(meters) || 0;
  if (m <= 0) return 0;
  return m <= 0.5 ? 0.5 : Math.ceil(m);
}

/** Preço do arquivo: meio metro tem preço próprio; o resto é metros × o preço da faixa em que a metragem cai. */
export function dtfFileCost(table: DtfTable, meters: number) {
  const billed = dtfBilledMeters(meters);
  if (billed === 0) return 0;
  if (billed === 0.5) return Number(table.halfMeter) || 0;
  const tier = [...table.tiers].sort((a, b) => b.minMeters - a.minMeters).find(t => billed >= t.minMeters);
  return billed * (Number(tier?.pricePerMeter) || 0);
}

/** Custo por peça. Sem metragem ou sem estampas não há conta: null, e o orçamento trava até preencher. */
export function dtfPieceCost(
  table: DtfTable,
  input: {
    meters?: number | null;
    prints?: number | null;
    printsPerPiece?: number | null;
    filesPerTrip?: number | null;
  },
) {
  const prints = Number(input.prints) || 0;
  const meters = Number(input.meters) || 0;
  if (meters <= 0 || prints <= 0) return null;
  // A retirada soma ao arquivo e se divide pelas estampas dele: pesa centavos por estampa, não reais por camiseta.
  const file = dtfFileCost(table, meters) + dtfTripCost(table, input.filesPerTrip);
  return (file / prints) * (Number(input.printsPerPiece) || 1);
}
