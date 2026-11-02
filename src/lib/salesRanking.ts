/**
 * salesRanking.ts — ranking dos mais vendidos da loja (Estacionamento item 23, 2/11/2026): quantidade e faturamento
 * (no Pix) por produto, a partir dos orçamentos. Usado no Dashboard e no Painel de Produção.
 */

type ItemFields = { productId?: string | null; productName?: string; quantity?: number; totalPrice?: number };
type QuoteFields = { status?: string; date?: string; items?: ItemFields[] };

export type RankingPeriod = '30d' | '90d' | 'year' | 'all';
export type RankingSort = 'quantity' | 'revenue';

export const RANKING_PERIODS: { value: RankingPeriod; label: string }[] = [
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
  { value: 'year', label: 'Este ano' },
  { value: 'all', label: 'Tudo' },
];

export interface RankingRow {
  key: string;
  name: string;
  quantity: number;
  revenue: number;
}

/** Status que contam como venda; "Pendente" e "Cancelado" ficam de fora. */
const SOLD = new Set(['Aprovado', 'Em produção', 'Finalizado']);

/**
 * Início do período (ISO), comparado com a data do orçamento; null = tudo. A data é a de criação do orçamento: o
 * sistema não guarda quando ele foi aprovado.
 */
export function periodStart(period: RankingPeriod, now = new Date()): string | null {
  if (period === 'all') return null;
  if (period === 'year') return new Date(now.getFullYear(), 0, 1).toISOString();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - (period === '30d' ? 29 : 89));
  return start.toISOString();
}

/**
 * Junta os itens vendidos por produto (pelo id; sem id, pelo nome) e ordena do maior para o menor. O nome mostrado é o
 * atual do cadastro quando o produto ainda existe, para um produto renomeado não virar duas linhas.
 */
export function salesRanking(
  quotes: QuoteFields[],
  { since = null, sort = 'quantity', currentNames = {} }: {
    since?: string | null;
    sort?: RankingSort;
    currentNames?: Record<string, string>;
  } = {},
): RankingRow[] {
  const rows = new Map<string, RankingRow>();
  for (const quote of quotes) {
    if (!quote.status || !SOLD.has(quote.status)) continue;
    if (since && (!quote.date || quote.date < since)) continue;
    for (const item of quote.items || []) {
      const name = (item.productName || '').trim();
      const key = item.productId ? `id:${item.productId}` : `nome:${name.toLowerCase()}`;
      if (key === 'nome:') continue;
      const row = rows.get(key) ?? {
        key,
        name: (item.productId && currentNames[item.productId]) || name,
        quantity: 0,
        revenue: 0,
      };
      row.quantity += Number(item.quantity) || 0;
      row.revenue += Number(item.totalPrice) || 0;
      rows.set(key, row);
    }
  }
  const other: RankingSort = sort === 'quantity' ? 'revenue' : 'quantity';
  const value = (r: RankingRow, s: RankingSort) => (s === 'quantity' ? r.quantity : r.revenue);
  return [...rows.values()].sort(
    (a, b) => value(b, sort) - value(a, sort) || value(b, other) - value(a, other) || a.name.localeCompare(b.name),
  );
}
