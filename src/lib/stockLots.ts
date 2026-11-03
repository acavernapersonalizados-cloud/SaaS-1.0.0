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
  id = newLotId(),
): StockLot[] {
  const qty = round(Math.max(0, quantity));
  if (qty <= EPS) return lots;
  const exp = expiresAt || null;
  const same = lots.find(l => l.expiresAt === exp);
  if (same) return lots.map(l => (l === same ? { ...l, quantity: round(l.quantity + qty) } : l));
  return [...lots, { id, quantity: qty, expiresAt: exp, createdAt: now }];
}

/** Código do lote "sem validade" criado na leitura: fixo, para a tela e a gravação acharem o mesmo lote. */
const UNDATED_ID = 'sem-validade';

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
    return addToLots(lots, diff, null, createdAt, lots.some(l => l.id === UNDATED_ID) ? newLotId() : UNDATED_ID);
  }
  if (diff < -EPS) return takeFromLots(lots, -diff, today, true).lots;
  return lots;
}

/**
 * "Alterar validade" (item 21): passa `quantity` do lote `lotId` para a validade `expiresAt` (null = sem validade).
 * Parte do lote vira outro lote; se já existe lote com essa data, junta nele. O saldo não muda. Devolve o erro em
 * texto quando a quantidade não serve.
 */
export function changeLotExpiry(
  lots: StockLot[],
  lotId: string,
  quantity: number,
  expiresAt: string | null,
  now = new Date().toISOString(),
): { lots: StockLot[] } | { error: string } {
  const lot = lots.find(l => l.id === lotId);
  if (!lot) return { error: 'Lote não encontrado (o estoque mudou). Abra de novo.' };
  const qty = round(Number(quantity) || 0);
  if (!(qty > EPS)) return { error: 'Informe uma quantidade maior que zero.' };
  if (qty > lot.quantity + EPS) return { error: `A quantidade passa do lote (${lot.quantity}).` };
  const exp = expiresAt || null;
  if (exp === lot.expiresAt) return { lots };
  const rest = round(lot.quantity - qty);
  const without = lots.flatMap(l => (l.id !== lotId ? [l] : rest > EPS ? [{ ...l, quantity: rest }] : []));
  const target = without.find(l => l.expiresAt === exp);
  if (target) return { lots: without.map(l => (l === target ? { ...l, quantity: round(l.quantity + qty) } : l)) };
  // O lote inteiro só troca a data (mantém o id); uma parte vira lote novo.
  if (rest <= EPS) return { lots: lots.map(l => (l.id === lotId ? { ...l, expiresAt: exp } : l)) };
  return { lots: [...without, { id: newLotId(), quantity: qty, expiresAt: exp, createdAt: now }] };
}

// ── 21B: avisos e descarte ────────────────────────────────────────────────

/** Prazo do aviso amarelo ("vence em X dias") quando a loja não gravou o seu na Base de Custos. */
export const DEFAULT_EXPIRY_WARNING_DAYS = 30;

/** Prazo do aviso da loja (0 a 365 dias) ou, sem ele, o padrão de 30. */
export function expiryWarningDaysOf(costs: { expiryWarningDays?: number } | null | undefined): number {
  const raw = costs?.expiryWarningDays;
  const days = Math.floor(Number(raw));
  if (raw === undefined || raw === null || !Number.isFinite(days) || days < 0) return DEFAULT_EXPIRY_WARNING_DAYS;
  return Math.min(365, days);
}

/** Dias corridos de hoje até a validade (0 = vence hoje; negativo = vencido). */
export function daysUntil(expiresAt: string, today: string): number {
  const toUtc = (d: string) => {
    const [y, m, day] = d.split('-').map(Number);
    return Date.UTC(y, m - 1, day);
  };
  return Math.round((toUtc(expiresAt) - toUtc(today)) / 86400000);
}

export type LotAlert = { kind: 'expired' } | { kind: 'soon'; days: number } | null;

/** Vermelho = vencido; amarelo = vence em até `warnDays` dias (hoje incluso); sem validade nunca avisa. */
export function lotAlert(lot: Pick<StockLot, 'expiresAt'>, today: string, warnDays: number): LotAlert {
  if (!lot.expiresAt) return null;
  const days = daysUntil(lot.expiresAt, today);
  if (days < 0) return { kind: 'expired' };
  return days <= warnDays ? { kind: 'soon', days } : null;
}

/** Texto do aviso: "vencido", "vence hoje", "vence amanhã", "vence em 12 dias". */
export function lotAlertText(alert: LotAlert): string {
  if (!alert) return '';
  if (alert.kind === 'expired') return 'vencido';
  return alert.days === 0 ? 'vence hoje' : alert.days === 1 ? 'vence amanhã' : `vence em ${alert.days} dias`;
}

export interface ExpiryAlertRow {
  materialId: string;
  materialName: string;
  unit: string;
  lot: StockLot;
  alert: NonNullable<LotAlert>;
}

/** Lotes com aviso da loja: vencidos primeiro, depois os que vencem antes. */
export function expiryAlerts(
  materials: Array<{ id: string; name?: string; unit?: string } & MaterialStock>,
  today: string,
  warnDays: number,
): ExpiryAlertRow[] {
  const rows: ExpiryAlertRow[] = [];
  for (const m of materials)
    for (const lot of materialLots(m, today)) {
      const alert = lotAlert(lot, today, warnDays);
      if (alert) rows.push({ materialId: m.id, materialName: m.name || '', unit: m.unit || '', lot, alert });
    }
  return rows.sort((a, b) => (a.lot.expiresAt || '').localeCompare(b.lot.expiresAt || ''));
}

/** "Descartar lote": tira o lote inteiro. O saldo cai junto (stockFields). */
export function discardLot(
  lots: StockLot[],
  lotId: string,
): { lots: StockLot[]; removed: StockLot } | { error: string } {
  const removed = lots.find(l => l.id === lotId);
  if (!removed) return { error: 'Lote não encontrado (o estoque mudou). Abra de novo.' };
  return { lots: lots.filter(l => l.id !== lotId), removed };
}

/** Validade para a tela: "10/12/2026" ou "sem validade". */
export const formatLotDate = (expiresAt: string | null) =>
  expiresAt ? expiresAt.split('-').reverse().join('/') : 'sem validade';

/**
 * Valor do estoque (card "Valor Total em Estoque"): saldo × custo por unidade de cada insumo. Conta única (2/11/2026),
 * para dividir lote não mudar o total e Entrada/Saída mudarem exatamente quantidade × custo.
 */
export const stockValue = (materials: Array<{ stockQuantity?: number; unitCost?: number }>) =>
  Math.round(materials.reduce((a, m) => a + (Number(m.stockQuantity) || 0) * (Number(m.unitCost) || 0), 0) * 100) / 100;

// ── Item 27: perdas por vencimento ────────────────────────────────────────

export interface DiscardMovement {
  materialId?: string;
  quantity?: number;
  /** Gravados a partir do item 27; descartes de antes não têm (valem o custo de hoje, "aprox."). */
  unitCost?: number;
  value?: number;
  createdAt?: string;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Perdido (R$) no mês e no ano de hoje, pelos descartes. `approx` = quantos usaram o custo de hoje. */
export function lossSummary(
  discards: DiscardMovement[],
  materials: Array<{ id: string; unitCost?: number }>,
  now = new Date(),
): { month: number; year: number; approx: number } {
  const cost = new Map(materials.map(m => [m.id, Number(m.unitCost) || 0]));
  const today = todayISO(now);
  let month = 0;
  let year = 0;
  let approx = 0;
  for (const d of discards) {
    if (!d.createdAt) continue;
    const day = todayISO(new Date(d.createdAt));
    if (day.slice(0, 4) !== today.slice(0, 4)) continue;
    const exact = d.value !== undefined && d.value !== null;
    const value = exact
      ? Number(d.value) || 0
      : (Number(d.quantity) || 0) * (d.unitCost ?? cost.get(d.materialId || '') ?? 0);
    if (!exact && d.unitCost === undefined) approx++;
    year += value;
    if (day.slice(0, 7) === today.slice(0, 7)) month += value;
  }
  return { month: r2(month), year: r2(year), approx };
}

export type RiskRow = ExpiryAlertRow & { value: number };

/**
 * Valor parado em lotes vencidos (ainda não descartados) e lista do que vence dentro do prazo do aviso, com o valor
 * em risco (quantidade × custo por unidade de hoje), do que vence primeiro.
 */
export function expiryRisk(
  materials: Array<{ id: string; name?: string; unit?: string; unitCost?: number } & MaterialStock>,
  today: string,
  warnDays: number,
): { expiredValue: number; soonValue: number; soon: RiskRow[]; expired: RiskRow[] } {
  const cost = new Map(materials.map(m => [m.id, Number(m.unitCost) || 0]));
  const rows = expiryAlerts(materials, today, warnDays).map(r => ({
    ...r,
    value: r2(r.lot.quantity * (cost.get(r.materialId) || 0)),
  }));
  const expired = rows.filter(r => r.alert.kind === 'expired');
  const soon = rows.filter(r => r.alert.kind === 'soon');
  const sum = (a: RiskRow[]) => r2(a.reduce((s, r) => s + r.value, 0));
  return { expiredValue: sum(expired), soonValue: sum(soon), soon, expired };
}

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
