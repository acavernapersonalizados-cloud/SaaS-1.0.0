/**
 * clientStats.ts — números do cliente (total gasto, nº de orçamentos e última compra),
 * calculados a partir dos orçamentos da loja. Usado em Clients.tsx.
 */

type QuoteFields = { clientId?: string; status?: string; totalAmount?: number; date?: string };

export interface ClientStats {
  totalSpent: number;
  quoteCount: number;
  lastPurchase: string | null;
}

/** Status que contam como compra; "Pendente" ainda não é compra. */
const PURCHASED = new Set(['Aprovado', 'Em produção', 'Finalizado']);

/** Números por cliente (chave: clientId). Orçamentos sem cliente vinculado ficam de fora. */
export function clientStats(quotes: QuoteFields[]): Map<string, ClientStats> {
  const stats = new Map<string, ClientStats>();
  for (const quote of quotes) {
    if (!quote.clientId) continue;
    const s = stats.get(quote.clientId) ?? { totalSpent: 0, quoteCount: 0, lastPurchase: null };
    s.quoteCount += 1;
    if (quote.status && PURCHASED.has(quote.status)) {
      s.totalSpent += Number(quote.totalAmount) || 0;
      if (quote.date && (!s.lastPurchase || quote.date > s.lastPurchase)) s.lastPurchase = quote.date;
    }
    stats.set(quote.clientId, s);
  }
  return stats;
}
