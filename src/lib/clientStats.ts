/**
 * clientStats.ts — números do cliente (total gasto, nº de orçamentos e última compra),
 * calculados a partir dos orçamentos da loja. Usado em Clients.tsx.
 */

type QuoteFields = { clientId?: string; clientName?: string; status?: string; totalAmount?: number; date?: string };
type ClientFields = { id: string; name?: string };

export interface ClientStats {
  totalSpent: number;
  quoteCount: number;
  lastPurchase: string | null;
}

/** Status que contam como compra; "Pendente" ainda não é compra. */
const PURCHASED = new Set(['Aprovado', 'Em produção', 'Finalizado']);

const normalizeName = (name?: string) => (name || '').trim().toLowerCase();

/**
 * Orçamentos de cada cliente (chave: id do cliente), do mais recente para o mais antigo.
 * Liga pelo clientId; sem ele (nome digitado sem escolher da lista na Precificação), liga pelo
 * nome, mas só quando um único cliente da loja tem esse nome.
 */
export function quotesByClient<Q extends QuoteFields>(quotes: Q[], clients: ClientFields[]): Map<string, Q[]> {
  const byName = new Map<string, string | null>();
  for (const c of clients) {
    const key = normalizeName(c.name);
    if (key) byName.set(key, byName.has(key) ? null : c.id);
  }
  const ids = new Set(clients.map(c => c.id));
  const linked = new Map<string, Q[]>();
  for (const quote of quotes) {
    const id = quote.clientId && ids.has(quote.clientId) ? quote.clientId : byName.get(normalizeName(quote.clientName));
    if (!id) continue;
    linked.set(id, [...(linked.get(id) ?? []), quote]);
  }
  for (const list of linked.values()) list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return linked;
}

/** Números por cliente. Só contam orçamentos Aprovados, Em produção e Finalizados. */
export function clientStats(quotes: QuoteFields[], clients: ClientFields[]): Map<string, ClientStats> {
  const stats = new Map<string, ClientStats>();
  for (const [id, list] of quotesByClient(quotes, clients)) {
    const s: ClientStats = { totalSpent: 0, quoteCount: 0, lastPurchase: null };
    for (const quote of list) {
      if (!quote.status || !PURCHASED.has(quote.status)) continue;
      s.quoteCount += 1;
      s.totalSpent += Number(quote.totalAmount) || 0;
      if (quote.date && (!s.lastPurchase || quote.date > s.lastPurchase)) s.lastPurchase = quote.date;
    }
    stats.set(id, s);
  }
  return stats;
}
