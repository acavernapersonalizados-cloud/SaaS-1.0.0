// Caracterização (Etapa 4, A7): grava cada comando de desenho dos 3 PDFs, na ordem.
// O jsPDF e o autoTable são simulados; se qualquer texto, posição, fonte ou cor mudar,
// o snapshot quebra.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Quote, Store } from '../types';

const calls: unknown[][] = [];
vi.mock('jspdf', () => ({
  jsPDF: class {
    lastAutoTable?: { finalY: number };
    constructor() {
      return new Proxy(this, {
        get(target, prop) {
          if (prop in target) return (target as Record<string | symbol, unknown>)[prop];
          return (...args: unknown[]) => {
            calls.push([String(prop), ...args]);
          };
        },
      });
    }
  },
}));
vi.mock('jspdf-autotable', () => ({
  default: (doc: { lastAutoTable?: { finalY: number } }, options: unknown) => {
    calls.push(['autoTable', options]);
    doc.lastAutoTable = { finalY: 150 };
  },
}));

const { generateClientPDF, generateInternalPDF, generateInvoicePDF } = await import('./pdf');

const store: Store = {
  id: 'loja-teste',
  name: 'Loja Teste LTDA',
  fantasyName: 'Loja Teste',
  phone: '(11) 99999-9999',
  email: 'loja@teste.local',
  city: 'São Paulo',
  state: 'SP',
  primaryColor: '#3366cc',
};

const quote = {
  id: 'q1',
  storeId: 'loja-teste',
  date: '2026-10-17T15:00:00.000Z',
  expiryDate: '2026-10-22T15:00:00.000Z',
  clientName: 'TESTE Cliente Ação',
  clientType: 'PJ',
  cnpj: '12.345.678/0001-90',
  channel: 'Shopee',
  platformFee: 20,
  status: 'Pendente',
  totalAmount: 270,
  totalProfit: 141,
  avgMargin: 52.2,
  items: [
    {
      id: 'i1',
      productId: 'chaveiro',
      productName: 'TESTE Chaveiro',
      quantity: 10,
      unitPrice: 27,
      totalPrice: 270,
      basePrice: 25,
      finishingValue: 2,
      accessoriesValue: 0,
      selectedFinishingIds: ['verniz'],
      selectedAccessoryIds: [],
      finishingNames: ['Verniz'],
      accessoryNames: [],
    },
    {
      id: 'i2',
      productId: 'caneca',
      productName: 'TESTE Caneca',
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
      basePrice: 0,
      finishingValue: 0,
      accessoriesValue: 0,
      selectedFinishingIds: [],
      selectedAccessoryIds: ['caixa'],
      accessoryNames: ['Caixinha'],
    },
  ],
} as unknown as Quote;

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-17T15:00:00.000Z'));
  vi.spyOn(Math, 'random').mockReturnValue(0.1234);
});
afterAll(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function draw(fn: typeof generateClientPDF, s: Store | null, q: Quote = quote) {
  calls.length = 0;
  await fn(q, s);
  return calls.map(c => [...c]);
}

describe('Comandos de desenho dos PDFs (não podem mudar)', () => {
  it('PDF do cliente — com loja', async () => {
    expect(await draw(generateClientPDF, store)).toMatchSnapshot();
  });
  it('PDF do cliente — sem loja e sem CNPJ', async () => {
    expect(await draw(generateClientPDF, null, { ...quote, cnpj: undefined })).toMatchSnapshot();
  });
  it('PDF interno — com loja', async () => {
    expect(await draw(generateInternalPDF, store)).toMatchSnapshot();
  });
  it('PDF interno — sem loja e sem CNPJ', async () => {
    expect(await draw(generateInternalPDF, null, { ...quote, cnpj: undefined })).toMatchSnapshot();
  });
  it('"Nota fiscal" — com loja', async () => {
    expect(await draw(generateInvoicePDF, store)).toMatchSnapshot();
  });
  it('"Nota fiscal" — sem loja e sem CNPJ', async () => {
    expect(await draw(generateInvoicePDF, null, { ...quote, cnpj: undefined })).toMatchSnapshot();
  });
});

// Etapa 8C, item 3b — orçamentos novos têm o total no Pix e no crédito (Pix ÷ 0,95).
describe('PDFs com preço no Pix e no crédito', () => {
  const withCredit = { ...quote, creditTotal: quote.totalAmount / 0.95 };
  const texts = (cmds: unknown[][]) => cmds.filter(c => c[0] === 'text').map(c => String(c[1]));
  const credit = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(withCredit.creditTotal);
  it.each([
    ['cliente', generateClientPDF, 'Total no Pix', `No crédito: ${credit}`],
    ['interno', generateInternalPDF, 'Total no Pix', `No crédito: ${credit} (cobre os 5% do cartão)`],
    ['recibo', generateInvoicePDF, 'VALOR TOTAL NO PIX', `NO CRÉDITO: ${credit}`],
  ])('PDF %s mostra os dois totais', async (_name, fn, pixLabel, creditLine) => {
    const t = texts(await draw(fn, store, withCredit));
    expect(t.some(s => s.startsWith(`${pixLabel}: `))).toBe(true);
    expect(t).toContain(creditLine);
  });
});
