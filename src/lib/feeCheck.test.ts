// Etapa 9C — verificação das taxas com IA: só sugestões válidas e com fonte; nada é aplicado sozinho.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SALES_CHANNELS } from './channels';
import { applyFeeSuggestion, buildFeeCheckPrompt, parseFeeSuggestions } from './feeCheck';

const channels = DEFAULT_SALES_CHANNELS;

describe('Pedido para a IA', () => {
  it('leva a tabela atual da loja e pede só o que mudou, com a fonte', () => {
    const p = buildFeeCheckPrompt(channels);
    expect(p).toContain('id "shopee" — Shopee: comissão 20%, taxa fixa R$ 4 por unidade');
    expect(p).toContain('sourceUrl');
    expect(p).toContain('Se nada mudou, responda []');
  });
});

describe('Leitura da resposta da IA', () => {
  it('aceita só sugestões com canal da tabela, campo conhecido, número válido e link', () => {
    const text = `Aqui está:
\`\`\`json
[
  {"channelId": "shopee", "field": "commissionPct", "suggested": 22, "sourceUrl": "https://seller.shopee.com.br/taxas", "note": "Comissão de 22%"},
  {"channelId": "shopee", "field": "fixedFee", "suggested": 4, "sourceUrl": "https://seller.shopee.com.br/taxas"},
  {"channelId": "ifood", "field": "commissionPct", "suggested": 27, "sourceUrl": ""},
  {"channelId": "elo7", "field": "commissionPct", "suggested": 18, "sourceUrl": "https://elo7.com.br"},
  {"channelId": "mercado-livre", "field": "markup", "suggested": 10, "sourceUrl": "https://mercadolivre.com.br"},
  {"channelId": "99food", "field": "commissionPct", "suggested": 120, "sourceUrl": "https://99food.com"}
]
\`\`\``;
    const r = parseFeeSuggestions(text, channels);
    expect(r.unreadable).toBe(false);
    expect(r.suggestions).toEqual([
      {
        channelId: 'shopee',
        channelName: 'Shopee',
        field: 'commissionPct',
        current: 20,
        suggested: 22,
        sourceUrl: 'https://seller.shopee.com.br/taxas',
        note: 'Comissão de 22%',
      },
    ]);
    // Taxa fixa igual à atual não é mudança; sem link, canal fora da tabela, campo estranho e 120%: descartados.
    expect(r.discarded).toBe(4);
  });
  it('lista vazia: nenhuma mudança; texto sem JSON ou sem IA: resposta ilegível', () => {
    expect(parseFeeSuggestions('[]', channels)).toEqual({ suggestions: [], discarded: 0, unreadable: false });
    expect(parseFeeSuggestions('Não encontrei nada.', channels).unreadable).toBe(true);
    expect(parseFeeSuggestions(null, channels).unreadable).toBe(true);
  });
});

describe('Aplicar uma sugestão aprovada', () => {
  it('troca só aquele campo daquele canal', () => {
    const [s] = parseFeeSuggestions(
      '[{"channelId":"shopee","field":"commissionPct","suggested":22,"sourceUrl":"https://x.com"}]',
      channels,
    ).suggestions;
    const out = applyFeeSuggestion(channels, s);
    expect(out.find(c => c.id === 'shopee')).toMatchObject({ commissionPct: 22, fixedFee: 4, paymentPct: 0 });
    expect(out.filter(c => c.id !== 'shopee')).toEqual(channels.filter(c => c.id !== 'shopee'));
  });
});
