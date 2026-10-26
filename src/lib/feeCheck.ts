/**
 * feeCheck.ts — verificação das taxas dos canais com IA (Etapa 9C).
 * A IA pesquisa as páginas oficiais e devolve as mudanças sugeridas com a fonte. Nada é aplicado sozinho:
 * cada sugestão é aprovada ou recusada na Base de Custos. Sugestão sem fonte (link) é descartada.
 */
import type { SalesChannel } from '../types';
import { MAX_CHANNEL_FEE_PERCENT } from './pricingEngine';

export type FeeField = 'commissionPct' | 'fixedFee' | 'paymentPct';

export const FEE_FIELD_LABELS: Record<FeeField, string> = {
  commissionPct: 'Comissão %',
  fixedFee: 'Taxa fixa R$',
  paymentPct: 'Pagamento %',
};

export interface FeeSuggestion {
  channelId: string;
  channelName: string;
  field: FeeField;
  current: number;
  suggested: number;
  /** Link da página onde a IA encontrou o valor. */
  sourceUrl: string;
  note: string;
}

/** Pedido para a IA: a tabela atual e o formato exato da resposta. */
export function buildFeeCheckPrompt(channels: SalesChannel[]): string {
  const table = channels
    .map(
      c =>
        `- id "${c.id}" — ${c.name}: comissão ${c.commissionPct}%, taxa fixa R$ ${c.fixedFee} por unidade, ` +
        `taxa de pagamento ${c.paymentPct}%${c.note ? ` (obs.: ${c.note})` : ''}`,
    )
    .join('\n');
  return `Você confere as taxas cobradas de um pequeno ateliê brasileiro em cada canal de venda.
Tabela atual do ateliê:
${table}

Pesquise nas páginas OFICIAIS de cada canal (central de ajuda ou de vendedores) as taxas atuais no Brasil para o vendedor
comum (pessoa física ou MEI, anúncio padrão). Ignore "Venda Direta" e canais sem taxa pública.
Responda SOMENTE com um JSON (lista), sem texto antes ou depois, com uma linha por valor DIFERENTE do da tabela:
[{"channelId": "shopee", "field": "commissionPct" | "fixedFee" | "paymentPct", "suggested": 22,
  "sourceUrl": "https://link-da-pagina-oficial", "note": "resumo curto do que a página diz"}]
Se nada mudou, responda []. Não invente: sem página oficial com o valor, não inclua a linha.`;
}

/** Primeiro trecho de JSON em lista ([...]) do texto da IA, ou null. */
function extractJsonList(text: string): unknown[] | null {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start < 0 || end <= start) return null;
  try {
    const data = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

const isFeeField = (f: unknown): f is FeeField => f === 'commissionPct' || f === 'fixedFee' || f === 'paymentPct';

/**
 * Sugestões válidas da resposta da IA: canal da tabela, campo conhecido, número dentro dos limites, diferente do atual
 * e com link http(s). O resto é descartado (e contado, para a tela avisar).
 */
export function parseFeeSuggestions(
  text: string | null,
  channels: SalesChannel[],
): { suggestions: FeeSuggestion[]; discarded: number; unreadable: boolean } {
  const list = text ? extractJsonList(text) : null;
  if (!list) return { suggestions: [], discarded: 0, unreadable: true };
  const suggestions: FeeSuggestion[] = [];
  let discarded = 0;
  for (const raw of list) {
    const item = (raw ?? {}) as Record<string, unknown>;
    const channel = channels.find(c => c.id === item.channelId);
    const suggested = Number(item.suggested);
    const sourceUrl = String(item.sourceUrl ?? '');
    const max = item.field === 'fixedFee' ? Infinity : MAX_CHANNEL_FEE_PERCENT;
    if (
      !channel ||
      !isFeeField(item.field) ||
      !Number.isFinite(suggested) ||
      suggested < 0 ||
      suggested > max ||
      !/^https?:\/\/\S+$/.test(sourceUrl)
    ) {
      discarded++;
      continue;
    }
    const current = Number(channel[item.field]) || 0;
    if (Math.abs(current - suggested) < 0.005) continue; // igual ao atual: não é mudança
    suggestions.push({
      channelId: channel.id,
      channelName: channel.name,
      field: item.field,
      current,
      suggested,
      sourceUrl,
      note: String(item.note ?? '').slice(0, 300),
    });
  }
  return { suggestions, discarded, unreadable: false };
}

/** A tabela com a sugestão aprovada aplicada (só aquele campo daquele canal). */
export function applyFeeSuggestion(channels: SalesChannel[], s: FeeSuggestion): SalesChannel[] {
  return channels.map(c => (c.id === s.channelId ? { ...c, [s.field]: s.suggested } : c));
}
