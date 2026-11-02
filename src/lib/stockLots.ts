/**
 * stockLots.ts — validade por lotes (Estacionamento item 21, 2/11/2026). O insumo continua um só no cadastro; cada
 * entrada de estoque vira um lote com quantidade e validade. O saldo (`stockQuantity`) continua gravado e é sempre a
 * soma dos lotes, para as telas que só leem o saldo seguirem iguais.
 *
 * Regra de consumo (baixa e reserva): primeiro o lote NÃO vencido que vence antes; os "sem validade" por último. Lote
 * vencido não é consumido: fica até a pessoa descartar.
 */

export interface StockLot {
  id: string;
  quantity: number;
  /** Validade (AAAA-MM-DD); null = sem validade. Vale até o fim do dia. */
  expiresAt: string | null;
  createdAt: string;
}

export interface LotTake {
  lotId: string;
  expiresAt: string | null;
  quantity: number;
}

type MaterialStock = { stockQuantity?: number; stockLots?: StockLot[]; createdAt?: string };

const EPS = 1e-9;
const round = (n: number) => Math.round(n * 1e6) / 1e6;

/** Data de hoje no fuso do aparelho (AAAA-MM-DD), comparável com `expiresAt`. */
export function todayISO(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export const isExpired = (lot: Pick<StockLot, 'expiresAt'>, today: string) => !!lot.expiresAt && lot.expiresAt < today;

export const lotsTotal = (lots: StockLot[]) => round(lots.reduce((a, l) => a + (Number(l.quantity) || 0), 0));

const newLotId = () => `lote_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

/** Ordem de consumo: não vencidos com validade (vence antes primeiro), depois sem validade (mais antigo primeiro). */
export function consumptionOrder(lots: StockLot[], today: string, includeExpired = false): StockLot[] {
  const byDate = (a: StockLot, b: StockLot) =>
    (a.expiresAt || '').localeCompare(b.expiresAt || '') || (a.createdAt || '').localeCompare(b.createdAt || '');
  const dated = lots.filter(l => l.expiresAt && !isExpired(l, today)).sort(byDate);
  const undated = lots.filter(l => !l.expiresAt).sort(byDate);
  const expired = includeExpired ? lots.filter(l => isExpired(l, today)).sort(byDate) : [];
  return [...dated, ...undated, ...expired];
}

/** Quantidade que pode ser consumida (sem os lotes vencidos). */
export const usableTotal = (lots: StockLot[], today: string) => lotsTotal(lots.filter(l => !isExpired(l, today)));

/**
 * Tira `quantity` dos lotes na ordem de consumo. `missing` é o que faltou (nunca fica negativo). Lotes zerados saem.
 * `includeExpired` só serve para acertar o saldo (ver `materialLots`).
 */
export function takeFromLots(
  lots: StockLot[],
  quantity: number,
  today: string,
  includeExpired = false,
): { lots: StockLot[]; taken: LotTake[]; missing: number } {
  let left = round(Math.max(0, quantity));
  const remaining = new Map(lots.map(l => [l.id, { ...l }]));
  const taken: LotTake[] = [];
  for (const lot of consumptionOrder(lots, today, includeExpired)) {
    if (left <= EPS) break;
    const current = remaining.get(lot.id)!;
    const take = round(Math.min(current.quantity, left));
    if (take <= EPS) continue;
    current.quantity = round(current.quantity - take);
    left = round(left - take);
    taken.push({ lotId: lot.id, expiresAt: lot.expiresAt, quantity: take });
  }
  return {
    lots: lots.map(l => remaining.get(l.id)!).filter(l => l.quantity > EPS),
    taken,
    missing: left > EPS ? left : 0,
  };
}

/** Soma uma entrada: junta com o lote de mesma validade, ou cria um lote novo. */
export function addToLots(
  lots: StockLot[],
  quantity: number,
  expiresAt: string | null,
  now = new Date().toISOString(),
): StockLot[] {
  const qty = round(Math.max(0, quantity));
  if (qty <= EPS) return lots;
  const exp = expiresAt || null;
  const same = lots.find(l => l.expiresAt === exp);
  if (same) return lots.map(l => (l === same ? { ...l, quantity: round(l.quantity + qty) } : l));
  return [...lots, { id: newLotId(), quantity: qty, expiresAt: exp, createdAt: now }];
}

/**
 * Lotes do insumo, sempre batendo com o saldo gravado. Sem lotes (estoque de antes do item 21), o saldo vira um lote
 * "sem validade". Se o saldo foi mudado por fora (tela antiga aberta, cadastro), a diferença entra como "sem validade"
 * ou sai na ordem de consumo (e, se precisar, dos vencidos).
 */
export function materialLots(material: MaterialStock, today = todayISO()): StockLot[] {
  const lots = (material.stockLots || [])
    .filter(l => (Number(l.quantity) || 0) > EPS)
    .map(l => ({ ...l, quantity: round(Number(l.quantity)), expiresAt: l.expiresAt || null }));
  const total = round(Math.max(0, Number(material.stockQuantity) || 0));
  const diff = round(total - lotsTotal(lots));
  if (diff > EPS) {
    const createdAt = material.stockLots?.length ? new Date().toISOString() : material.createdAt || '';
    return addToLots(lots, diff, null, createdAt);
  }
  if (diff < -EPS) return takeFromLots(lots, -diff, today, true).lots;
  return lots;
}

/** Validade para a tela: "10/12/2026" ou "sem validade". */
export const formatLotDate = (expiresAt: string | null) =>
  expiresAt ? expiresAt.split('-').reverse().join('/') : 'sem validade';

/** Campos a gravar no insumo: os lotes e o saldo (a soma deles). */
export const stockFields = (lots: StockLot[]) => ({ stockLots: lots, stockQuantity: lotsTotal(lots) });

/**
 * Lotes sugeridos para uma reserva: os outros orçamentos já reservados pegam primeiro (mesma ordem de consumo), e esta
 * reserva pega do que sobra. Não muda o estoque; o lote de verdade sai na baixa, pela ordem do dia da baixa.
 */
export function suggestLots(lots: StockLot[], alreadyReserved: number, quantity: number, today: string): LotTake[] {
  const afterOthers = takeFromLots(lots, alreadyReserved, today).lots;
  return takeFromLots(afterOthers, quantity, today).taken;
}
