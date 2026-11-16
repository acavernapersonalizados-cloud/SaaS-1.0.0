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
};

/** Limite do arquivo no fornecedor (250 cm): acima disso, é preciso separar. Só avisa; a conta não muda. */
export const DTF_FILE_LIMIT_METERS = 2.5;

export const dtfTableOf = (costs: Pick<CostBase, 'dtfTable'> | null | undefined): DtfTable =>
  costs?.dtfTable?.tiers?.length ? costs.dtfTable : DEFAULT_DTF_TABLE;

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
  input: { meters?: number | null; prints?: number | null; printsPerPiece?: number | null },
) {
  const prints = Number(input.prints) || 0;
  const meters = Number(input.meters) || 0;
  if (meters <= 0 || prints <= 0) return null;
  return (dtfFileCost(table, meters) / prints) * (Number(input.printsPerPiece) || 1);
}
