/**
 * quoteDate.ts — data da venda (Estacionamento item 28, 2/11/2026). A data da venda fica no próprio `date` (o campo que
 * ranking, Dashboard, Histórico, Clientes e PDFs já usam); a data de lançamento original vai para `createdAt` na
 * primeira troca e não muda mais. A validade (`expiryDate`) anda junto, com a mesma diferença que tinha.
 */

type QuoteDates = { date?: string; expiryDate?: string; createdAt?: string };

const pad = (n: number) => String(n).padStart(2, '0');

/** Dia (AAAA-MM-DD, fuso do aparelho) de uma data ISO. */
export function dayOf(iso: string | undefined): string {
  const d = new Date(iso || '');
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Dia digitado → ISO ao meio-dia local (o fuso não vira o dia anterior). */
export function dayToIso(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 12).toISOString();
}

export const isFutureDay = (day: string, today: string) => day > today;

/** Campos a gravar para a nova data da venda; null quando o dia é inválido ou igual. */
export function changeSaleDate(
  q: QuoteDates,
  day: string,
): { date: string; expiryDate: string; createdAt: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day === dayOf(q.date)) return null;
  const date = dayToIso(day);
  const oldDate = Date.parse(q.date || '');
  const oldExpiry = Date.parse(q.expiryDate || '');
  const gap = Number.isFinite(oldDate) && Number.isFinite(oldExpiry) ? oldExpiry - oldDate : 0;
  return {
    date,
    expiryDate: new Date(Date.parse(date) + gap).toISOString(),
    createdAt: q.createdAt || q.date || date,
  };
}

export type RevenuePeriod = 'thisMonth' | 'lastMonth' | 'thisYear';

export const REVENUE_PERIODS: { value: RevenuePeriod; label: string }[] = [
  { value: 'thisMonth', label: 'Este mês' },
  { value: 'lastMonth', label: 'Mês passado' },
  { value: 'thisYear', label: 'Este ano' },
];

/** Início (incluso) e fim (não incluso) do período, em ISO, no fuso do aparelho. */
export function periodBounds(period: RevenuePeriod, now = new Date()): { start: string; end: string } {
  const y = now.getFullYear();
  const m = now.getMonth();
  if (period === 'thisYear')
    return { start: new Date(y, 0, 1).toISOString(), end: new Date(y + 1, 0, 1).toISOString() };
  if (period === 'lastMonth')
    return { start: new Date(y, m - 1, 1).toISOString(), end: new Date(y, m, 1).toISOString() };
  return { start: new Date(y, m, 1).toISOString(), end: new Date(y, m + 1, 1).toISOString() };
}
