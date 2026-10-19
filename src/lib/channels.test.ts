// Etapa 7, item 5 — tabela única de canais de venda por loja.
import { describe, expect, it } from 'vitest';
import { channelFees, channelsOf, DEFAULT_SALES_CHANNELS, findChannel } from './channels';

describe('Tabela de canais', () => {
  it('valores aprovados em 19/10/2026', () => {
    const t = Object.fromEntries(
      DEFAULT_SALES_CHANNELS.map(c => [c.name, [c.commissionPct, c.fixedFee, c.paymentPct]]),
    );
    expect(t).toEqual({
      'Venda Direta': [0, 0, 0],
      Instagram: [0, 0, 3.5],
      Atacado: [5, 0, 0],
      Shopee: [20, 4, 0],
      'Mercado Livre': [18, 0, 0],
      iFood: [26.5, 0, 0],
      '99Food': [13, 0, 0],
    });
  });
  it('não tem Elo7 nem Keeta', () => {
    const names = DEFAULT_SALES_CHANNELS.map(c => c.name.toLowerCase());
    expect(names).not.toContain('elo7');
    expect(names).not.toContain('keeta');
  });
  it('loja sem tabela gravada usa a padrão; com tabela, usa a dela', () => {
    expect(channelsOf(null)).toEqual(DEFAULT_SALES_CHANNELS);
    expect(channelsOf({ salesChannels: [] })).toEqual(DEFAULT_SALES_CHANNELS);
    const propria = [{ id: 'x', name: 'Feira', commissionPct: 10, fixedFee: 0, paymentPct: 0 }];
    expect(channelsOf({ salesChannels: propria })).toEqual(propria);
  });
  it('taxas: comissão + pagamento (até 95%) e taxa fixa', () => {
    expect(channelFees({ commissionPct: 20, paymentPct: 0, fixedFee: 4 })).toEqual({ feePct: 20, fixedFee: 4 });
    expect(channelFees({ commissionPct: 0, paymentPct: 3.5, fixedFee: 0 })).toEqual({ feePct: 3.5, fixedFee: 0 });
    expect(channelFees({ commissionPct: 80, paymentPct: 30, fixedFee: -2 })).toEqual({ feePct: 95, fixedFee: 0 });
    expect(channelFees(undefined)).toEqual({ feePct: 0, fixedFee: 0 });
  });
  it('acha o canal pelo id ou pelo nome (orçamentos antigos guardam o nome)', () => {
    expect(findChannel(DEFAULT_SALES_CHANNELS, 'shopee')?.name).toBe('Shopee');
    expect(findChannel(DEFAULT_SALES_CHANNELS, 'Mercado Livre')?.id).toBe('mercado-livre');
    expect(findChannel(DEFAULT_SALES_CHANNELS, 'Elo7')).toBeUndefined();
  });
});
