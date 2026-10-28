// @vitest-environment jsdom
// Caracterização das telas (Etapa 4B): guarda o HTML de cada tela afetada por B1–B4, em vários estados.
// Firebase, login, loja e avisos são simulados (src/test). Se o HTML mudar, o snapshot quebra.
import React from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';

vi.mock('firebase/firestore', () => import('../test/firestoreMock'));
vi.mock('firebase/storage', () => ({
  getStorage: () => ({}),
  ref: () => ({}),
  uploadBytes: async () => ({}),
  getDownloadURL: async () => '',
  deleteObject: async () => {},
}));
vi.mock('firebase/auth', () => ({
  getAuth: () => ({}),
  createUserWithEmailAndPassword: async () => ({ user: { uid: 'novo-uid' } }),
  signOut: async () => {},
  onAuthStateChanged: () => () => {},
}));
vi.mock('firebase/app', () => ({ initializeApp: () => ({}), deleteApp: async () => {} }));
vi.mock('../firebase', () => import('../test/firebaseMock'));
vi.mock('../contexts/StoreContext', () => import('../test/contextMocks'));
vi.mock('../contexts/AuthContext', () => import('../test/contextMocks'));
vi.mock('../contexts/ToastContext', () => import('../test/contextMocks'));
// IA nunca é chamada de verdade nos testes (o .env pode ter a chave): toda função responde "sem IA".
// Etapa 9C: a verificação de taxas com IA é simulada; cada teste escolhe a resposta.
const geminiMock = vi.hoisted(() => ({
  checkChannelFees: vi.fn<
    (prompt: string) => Promise<{ text: string; sources: { title: string; uri: string }[] } | null>
  >(async () => null),
}));
vi.mock('../services/gemini', () => {
  const none = async () => null;
  return {
    checkChannelFees: geminiMock.checkChannelFees,
    aiUnavailableMessage: () => 'IA indisponível: a busca com fontes do Google não está liberada (teste).',
    analyzePriceHealth: none,
    suggestIdealMargin: none,
    analyzeManualPrice: none,
    analyzeLaserPrice: none,
    rewriteDescription: none,
    analyzePapelariaPrice: none,
    analyzeCestaPrice: none,
  };
});

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-17T15:00:00.000Z'));
  vi.spyOn(window, 'confirm').mockReturnValue(false);
});
afterAll(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
afterEach(() => cleanup());

// ─── Ajudantes ────────────────────────────────────────────────────────────────

const flush = () => act(async () => {});

async function show(ui: React.ReactElement) {
  render(ui);
  await flush();
}

/** Botão que contém o ícone lucide indicado (ex.: 'trash-2'). */
function buttonWithIcon(icon: string, index = 0) {
  const svgs = Array.from(document.querySelectorAll(`svg.lucide-${icon}`));
  const button = svgs.map(s => s.closest('button')).filter(Boolean)[index] as HTMLButtonElement | undefined;
  if (!button) throw new Error(`botão com ícone ${icon} não encontrado`);
  return button;
}

async function click(el: Element) {
  fireEvent.click(el);
  await flush();
}

async function type(el: Element, value: string) {
  fireEvent.change(el, { target: { value } });
  await flush();
}

function searchBox() {
  const input = document.querySelector('input[placeholder^="Buscar"], input[placeholder^="Pesquisar"]');
  if (!input) throw new Error('campo de busca não encontrado');
  return input;
}

/**
 * DOM atual para o snapshot. Com DUMP_HTML=<arquivo>, grava também o HTML final (innerHTML)
 * de cada estado, para comparar código antigo × novo caractere a caractere.
 */
const html = () => {
  const out = process.env.DUMP_HTML;
  if (out) require('fs').appendFileSync(out, `${expect.getState().currentTestName}\n${document.body.innerHTML}\n@@@\n`);
  return document.body;
};

/** Campo (input/select) que fica junto do rótulo com o texto indicado. */
function field(labelText: string) {
  const label = Array.from(document.querySelectorAll('label')).find(l => l.textContent?.includes(labelText));
  const el = label?.parentElement?.querySelector('input, select, textarea');
  if (!el) throw new Error(`campo "${labelText}" não encontrado`);
  return el;
}

function buttonWithText(text: string) {
  const button = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === text);
  if (!button) throw new Error(`botão "${text}" não encontrado`);
  return button;
}

/** Elemento mais interno com exatamente o texto indicado (para abrir um cartão/linha). */
function textElement(text: string) {
  const el = Array.from(document.querySelectorAll('body *')).find(
    e => e.children.length === 0 && e.textContent?.trim() === text,
  );
  if (!el) throw new Error(`texto "${text}" não encontrado`);
  return el;
}

/** Lista, busca e janela de exclusão: os estados que B1 (SearchBar/ConfirmDeleteModal) mexe. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function crudScreen(
  name: string,
  component: () => Promise<React.ComponentType<any>>,
  opts: { search?: string; remove?: boolean; openFirst?: string; props?: Record<string, unknown> },
) {
  const load = async () => React.createElement(await component(), opts.props);
  describe(name, () => {
    it('lista', async () => {
      await show(await load());
      expect(html()).toMatchSnapshot();
    });
    if (opts.search) {
      it('busca', async () => {
        await show(await load());
        await type(searchBox(), opts.search!);
        expect(html()).toMatchSnapshot();
      });
    }
    if (opts.remove) {
      it('confirmar exclusão', async () => {
        await show(await load());
        if (opts.openFirst) await click(textElement(opts.openFirst));
        await click(buttonWithIcon('trash-2'));
        expect(html()).toMatchSnapshot();
      });
    }
  });
}

// ─── Telas ────────────────────────────────────────────────────────────────────

// B1 — telas de cadastro (busca e/ou exclusão)
crudScreen('Matéria-prima', async () => (await import('./Materials')).Materials, { search: 'MDF', remove: true });
crudScreen('Clientes', async () => (await import('./Clients')).Clients, {
  search: 'TESTE',
  remove: true,
  openFirst: 'TESTE Cliente',
});
crudScreen('Fornecedores', async () => (await import('./Suppliers')).Suppliers, { search: 'TESTE', remove: true });
crudScreen('Histórico', async () => (await import('./History')).History, { search: 'Chaveiro', remove: true });

// Estacionamento item 17: mudar o status não abre o WhatsApp; o botão "Enviar no WhatsApp" é que abre (com o clique).
describe('Histórico: WhatsApp só no clique', () => {
  it('aprovar não abre o WhatsApp e mostra o botão com a mensagem do status', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    try {
      await show(React.createElement((await import('./History')).History));
      await click(buttonWithIcon('external-link'));
      expect(document.body.textContent).not.toContain('Enviar no WhatsApp');
      await click(buttonWithText('Aprovar'));
      await act(() => new Promise(r => setTimeout(r, 50)));
      expect(open).not.toHaveBeenCalled();
      const link = [...document.querySelectorAll('a')].find(a => a.textContent?.includes('Enviar no WhatsApp'))!;
      expect(link.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/5511999999999\?text=/);
      expect(decodeURIComponent(link.getAttribute('href')!)).toContain('foi aprovado');
    } finally {
      open.mockRestore();
    }
  });
});
crudScreen('Lojas', async () => (await import('./Stores')).Stores, { remove: true });
crudScreen('Usuários', async () => (await import('./Users')).Users, { remove: true });
crudScreen('Estoque', async () => (await import('./Inventory')).Inventory, { search: 'Fita' });
crudScreen('Catálogo', async () => (await import('./Catalog')).Catalog, { search: 'Chaveiro' });
crudScreen('Produtos', async () => (await import('./Products')).Products, { search: 'Chaveiro' });
crudScreen('Catálogo público', async () => (await import('./PublicCatalog')).PublicCatalog, {
  props: { storeId: 'loja-teste' },
  search: 'Chaveiro',
});
crudScreen('Lista de Compras', async () => (await import('./PurchaseList')).PurchaseList, {});

// B2–B4 — calculadoras (histórico de trabalhos, escolha de material e cartão de resultado)
describe('Corte a Laser', () => {
  const load = async () => React.createElement((await import('./LaserCalculator')).LaserCalculator);
  it('inicial, com máquina e histórico', async () => {
    await show(await load());
    expect(html()).toMatchSnapshot();
  });
  it('resultado (seção 12) e preço manual', async () => {
    await show(await load());
    await type(field('Tempo de Corte'), '10');
    await type(field('Tempo de Gravação'), '5');
    await type(field('Passadas'), '2');
    await type(field('Custo do Material'), '20');
    await type(field('Quantidade de peças'), '4');
    expect(html()).toMatchSnapshot();
    await type(field('Seu preço por peça'), '15');
    expect(html()).toMatchSnapshot();
  });
  // Estacionamento item 13 (opção A): com material do estoque, o custo vem dele e o trabalho grava qual e quanto.
  it('item 13: material do estoque calcula o custo e é gravado no trabalho', async () => {
    const { writes } = await import('../test/firestoreMock');
    writes.length = 0;
    await show(await load());
    await type(field('Nome do Trabalho'), 'TESTE Porta-chaves');
    await type(field('Tempo de Corte'), '10');
    await type(field('Quantidade de peças'), '4');
    await type(field('Material do estoque'), 'mdf');
    await type(field('Quanto o trabalho usa'), '1.5');
    expect(document.body.textContent?.replace(/\s/g, ' ')).toContain('Custo do material: R$ 22,50');
    await click(buttonWithText('Salvar Trabalho'));
    const job = writes.find(w => w.path === 'laserJobs')!.data;
    expect({
      material: job.material,
      materialCost: job.materialCost,
      materialId: job.materialId,
      materialQty: job.materialQty,
    }).toEqual({ material: 'TESTE MDF 3mm', materialCost: 22.5, materialId: 'mdf', materialQty: 1.5 });
  });
  it('item 13: sem material do estoque, grava como antes (custo digitado, sem vínculo)', async () => {
    const { writes } = await import('../test/firestoreMock');
    writes.length = 0;
    await show(await load());
    await type(field('Nome do Trabalho'), 'TESTE Porta-chaves');
    await type(field('Material'), 'MDF 3mm');
    await type(field('Tempo de Corte'), '10');
    await type(field('Custo do Material'), '20');
    await click(buttonWithText('Salvar Trabalho'));
    const job = writes.find(w => w.path === 'laserJobs')!.data;
    expect({ materialCost: job.materialCost, materialId: job.materialId, materialQty: job.materialQty }).toEqual({
      materialCost: 20,
      materialId: null,
      materialQty: 0,
    });
  });
});

describe('Impressão 3D', () => {
  const load = async () => React.createElement((await import('./PrintCalculator')).PrintCalculator);
  it('inicial com impressora: resultado padrão e histórico', async () => {
    await show(await load());
    expect(html()).toMatchSnapshot();
  });
  it('canal Shopee e preço manual', async () => {
    await show(await load());
    await type(field('Canal de venda'), 'shopee');
    expect(html()).toMatchSnapshot();
    const manual = document.querySelector('input[placeholder^="R$"]') ?? field('Seu preço');
    await type(manual, '20');
    expect(html()).toMatchSnapshot();
  });
  // Estacionamento item 11: com duas impressoras, nenhuma vem marcada e a tela pede para escolher.
  it('item 11: com duas impressoras, abre sem nenhuma marcada e pede para escolher', async () => {
    const { fixtures } = await import('../test/fixtures');
    const extra = { ...fixtures.printers[0], id: 'impressora-2', label: 'TESTE 3D 2' };
    fixtures.printers.push(extra);
    try {
      await show(await load());
      expect(document.body.textContent).toContain('Escolha a impressora para calcular.');
      expect(document.querySelectorAll('.border-neutral-900.bg-neutral-50')).toHaveLength(0);
      const card = [...document.querySelectorAll('div.cursor-pointer')].find(d =>
        d.textContent?.includes('TESTE 3D 2'),
      );
      await click(card!);
      expect(document.body.textContent).not.toContain('Escolha a impressora para calcular.');
    } finally {
      fixtures.printers.splice(fixtures.printers.indexOf(extra), 1);
    }
  });
});

for (const [name, file, component] of [
  ['Papelaria', './PapelariaCalculator', 'PapelariaCalculator'],
  ['Cestas', './CestaCalculator', 'CestaCalculator'],
] as const) {
  describe(name, () => {
    const load = async () => {
      const mod = (await import(file)) as Record<string, React.ComponentType>;
      const Screen = mod[component];
      return <Screen />;
    };
    it('inicial com histórico', async () => {
      await show(await load());
      expect(html()).toMatchSnapshot();
    });
    it('material do estoque: busca, escolha e aviso de saldo', async () => {
      await show(await load());
      await click(buttonWithText('Do estoque'));
      await type(searchBox(), 'Fita');
      const select = document.querySelector('select');
      if (!select) throw new Error('select do estoque não encontrado');
      await type(select, 'fita');
      const qty = document.querySelector('input[placeholder="Qtd"]');
      if (!qty) throw new Error('quantidade do estoque não encontrada');
      await type(qty, '50');
      expect(html()).toMatchSnapshot();
      // HTML final (string): igual mesmo que o React divida o texto em pedaços diferentes.
      expect(document.body.innerHTML).toMatchSnapshot();
    });
    it('resultado e preço manual', async () => {
      await show(await load());
      await type(field('Tempo de Montagem'), '60');
      expect(html()).toMatchSnapshot();
      await type(field(name === 'Papelaria' ? 'Seu preço por unidade' : 'Seu preço por cesta'), '15');
      expect(html()).toMatchSnapshot();
    });
  });
}

// Etapa 8A, item 1 — Precificação: o botão "Gerar Orçamento" e o que ele mostra quando falta algo.
describe('Precificação', () => {
  const load = async () => React.createElement((await import('./Pricing')).Pricing);
  const generate = () => buttonWithText('Gerar Orçamento');
  it('inicial: sem itens', async () => {
    await show(await load());
    expect(html()).toMatchSnapshot();
  });
  it('sem itens: clique em Gerar Orçamento', async () => {
    await show(await load());
    await click(generate());
    expect(html()).toMatchSnapshot();
  });
  it('com item e sem cliente: clique em Gerar Orçamento', async () => {
    await show(await load());
    await click(buttonWithText('Adicionar Item'));
    await type(field('Produto'), 'chaveiro');
    await click(buttonWithText('Confirmar Item'));
    await click(generate());
    expect(html()).toMatchSnapshot();
  });

  // Etapa 8A, item 2 — estados que a divisão de Pricing.tsx mexe.
  const clientInput = () => document.querySelector('input[placeholder="Ex: João Silva ou Empresa ABC"]')!;
  it('cliente: busca na lista e Pessoa Jurídica com CNPJ', async () => {
    await show(await load());
    await type(clientInput(), 'TESTE');
    expect(html()).toMatchSnapshot();
    await type(clientInput(), 'Ninguém');
    expect(html()).toMatchSnapshot();
    await click(buttonWithText('Pessoa Jurídica'));
    expect(html()).toMatchSnapshot();
  });
  it('item com acabamento, acessório e markup; quantidade e edição', async () => {
    await show(await load());
    await click(buttonWithText('Adicionar Item'));
    await type(field('Produto'), 'chaveiro');
    await click(textElement('Verniz'));
    await click(textElement('Caixinha'));
    await type(field('Markup personalizado'), '200');
    expect(html()).toMatchSnapshot();
    await click(buttonWithText('Confirmar Item'));
    expect(html()).toMatchSnapshot();
    await click(buttonWithIcon('plus', 1));
    await click(buttonWithIcon('file-text', 0));
    expect(html()).toMatchSnapshot();
  });
  it('canal Shopee no resumo', async () => {
    await show(await load());
    await click(buttonWithText('Adicionar Item'));
    await type(field('Produto'), 'chaveiro');
    await click(buttonWithText('Confirmar Item'));
    await type(document.querySelector('select')!, 'Shopee');
    expect(html()).toMatchSnapshot();
  });
  it('orçamento gerado', async () => {
    await show(await load());
    await click(buttonWithText('Adicionar Item'));
    await type(field('Produto'), 'chaveiro');
    await click(buttonWithText('Confirmar Item'));
    await type(clientInput(), 'Maria Teste');
    await click(generate());
    expect(html()).toMatchSnapshot();
  });

  // Etapa 8C, item 3a — desconto de atacado por quantidade, com piso de custo × 1,30 + taxas.
  const quantityInput = () =>
    Array.from(document.querySelectorAll('label'))
      .find(l => l.textContent?.trim() === 'Quantidade')!
      .parentElement!.querySelector('input')!;
  it('atacado: 30 unidades com 20% sobre o varejo, gravado no orçamento', async () => {
    const { writes } = await import('../test/firestoreMock');
    await show(await load());
    await click(buttonWithText('Adicionar Item'));
    await type(field('Produto'), 'chaveiro');
    await type(quantityInput(), '9');
    expect(document.body.textContent).not.toContain('Atacado: −');
    await type(quantityInput(), '30');
    expect(document.body.textContent).toContain('Atacado: −20,0% pela quantidade');
    expect(html()).toMatchSnapshot();
    await click(buttonWithText('Confirmar Item'));
    expect(document.body.textContent).toContain('atacado −20,0%');
    await type(clientInput(), 'Maria Teste');
    writes.length = 0;
    await click(generate());
    const quote = writes.find(w => w.path === 'quotes')!.data as { items: Array<Record<string, unknown>> };
    expect(quote.items[0]).toMatchObject({ quantity: 30, wholesaleDiscountPct: 20, wholesaleFloorApplied: false });
    expect(Number(quote.items[0].unitPrice)).toBeCloseTo(Number(quote.items[0].basePrice), 10);
  });
  it('atacado: markup personalizado baixo para no piso e avisa', async () => {
    await show(await load());
    await click(buttonWithText('Adicionar Item'));
    await type(field('Produto'), 'chaveiro');
    await type(field('Markup personalizado'), '40');
    await type(quantityInput(), '100');
    expect(document.body.textContent).toContain('O desconto passaria do piso (custo × 1,30 + taxas)');
    expect(html()).toMatchSnapshot();
  });
  // Estacionamento item 18: preço manual por unidade (Pix) com avisos; o crédito do orçamento é o total ÷ 0,95.
  it('item 18: preço manual avisa abaixo da meta e do custo e é gravado como preço no Pix', async () => {
    const { writes } = await import('../test/firestoreMock');
    await show(await load());
    await click(buttonWithText('Adicionar Item'));
    await type(field('Produto'), 'chaveiro');
    await type(quantityInput(), '10');
    const text = () => document.body.textContent?.replace(/\s/g, ' ') ?? '';
    await type(field('Preço manual'), '12');
    expect(text()).toContain('Abaixo da meta: o sugerido é');
    await type(field('Preço manual'), '1');
    expect(text()).toContain('Abaixo do custo: prejuízo de');
    await type(field('Preço manual'), '20');
    expect(text()).not.toContain('Abaixo da meta');
    expect(text()).toContain('R$ 200,00');
    await click(buttonWithText('Confirmar Item'));
    await type(clientInput(), 'Maria Teste');
    writes.length = 0;
    await click(generate());
    const quote = writes.find(w => w.path === 'quotes')!.data as {
      items: Array<Record<string, unknown>>;
      totalAmount: number;
      creditTotal: number;
    };
    expect(quote.items[0]).toMatchObject({ manualUnitPrice: 20, unitPrice: 20, totalPrice: 200 });
    expect(quote.totalAmount).toBe(200);
    expect(quote.creditTotal).toBeCloseTo(200 / 0.95, 10);
  });
});

// Etapa 9A — aviso de canal sem conferência há mais de 60 dias e botão "Conferi hoje".
describe('Canais sem conferência (60 dias)', () => {
  const text = () => (document.body.textContent ?? '').replace(/\s/g, ' ');
  it('Base de Custos: aviso com os canais e "Conferi hoje" grava só a data daquele canal', async () => {
    const { writes } = await import('../test/firestoreMock');
    const { CostBaseSettings } = await import('./CostBase');
    await show(<CostBaseSettings />);
    expect(text()).toContain('6 canais sem conferência há mais de 60 dias');
    expect(text()).toContain('Shopee (nunca conferido)');
    writes.length = 0;
    const shopeeRow = Array.from(document.querySelectorAll('tbody tr')).find(
      tr => (tr.querySelector('input') as HTMLInputElement | null)?.value === 'Shopee',
    )!;
    await click(Array.from(shopeeRow.querySelectorAll('button')).find(b => b.textContent === 'Conferi hoje')!);
    expect(writes).toHaveLength(1);
    expect(writes[0].op).toBe('set');
    expect(writes[0].path).toBe('costBases/loja-teste');
    expect(Object.keys(writes[0].data).sort()).toEqual(['salesChannels', 'storeId']);
    const saved = writes[0].data.salesChannels as Array<{ id: string; checkedAt?: string }>;
    expect(saved.filter(c => c.checkedAt).map(c => [c.id, c.checkedAt])).toEqual([['shopee', '2026-10-17']]);
    expect(text()).toContain('5 canais sem conferência há mais de 60 dias');
    expect(text()).not.toContain('Shopee (nunca conferido)');
    // Texto do piso de atacado com vírgula (corrigido na 9A).
    expect(text()).toContain('custo × 1,30 + taxas do canal');
  });
  it('Orçamentos: aviso das taxas sem conferência', async () => {
    const { Pricing } = await import('./Pricing');
    await show(<Pricing />);
    expect(text()).toContain('Taxas sem conferência há mais de 60 dias:');
    expect(text()).toContain('Mercado Livre (nunca conferido)');
  });
});

// Etapa 9C — "Verificar taxas com IA": sugestões com fonte; cada uma aprovada ou recusada.
describe('Verificar taxas com IA', () => {
  const text = () => (document.body.textContent ?? '').replace(/\s/g, ' ');
  // 26/10/2026: a 9C está desligada no app (sem a busca paga). Aqui ela é ligada só para testar o fluxo,
  // que volta junto com a Etapa 10.
  beforeEach(async () => {
    (await import('../lib/feeCheck')).FEE_CHECK.available = true;
  });
  afterEach(async () => {
    (await import('../lib/feeCheck')).FEE_CHECK.available = false;
  });
  it('desligada (sem a busca paga): botão desativado com o aviso, e o aviso de 60 dias continua', async () => {
    (await import('../lib/feeCheck')).FEE_CHECK.available = false;
    await loadCostBase();
    const button = buttonWithText('Verificar taxas com IA');
    expect(button.disabled).toBe(true);
    expect(text()).toContain('Disponível com o plano pago do Firebase (Etapa 10)');
    expect(text()).toContain('canais sem conferência há mais de 60 dias');
    geminiMock.checkChannelFees.mockClear();
    await click(button);
    expect(geminiMock.checkChannelFees).not.toHaveBeenCalled();
  });
  const answer = {
    text: JSON.stringify([
      {
        channelId: 'shopee',
        field: 'commissionPct',
        suggested: 22,
        sourceUrl: 'https://seller.shopee.com.br/taxas',
        note: 'Comissão de 22% para vendedor comum.',
      },
      { channelId: 'ifood', field: 'commissionPct', suggested: 27, sourceUrl: '' },
      {
        channelId: 'mercado-livre',
        field: 'commissionPct',
        suggested: 19,
        sourceUrl: 'https://www.mercadolivre.com.br/ajuda/custos',
      },
    ]),
    sources: [{ title: 'Taxas Shopee', uri: 'https://seller.shopee.com.br/taxas' }],
  };
  const loadCostBase = async () => {
    const { CostBaseSettings } = await import('./CostBase');
    await show(<CostBaseSettings />);
  };
  it('mostra as sugestões com a fonte; "Aplicar" grava só aquele campo e "Recusar" não grava nada', async () => {
    const { writes } = await import('../test/firestoreMock');
    geminiMock.checkChannelFees.mockResolvedValueOnce(answer);
    await loadCostBase();
    writes.length = 0;
    await click(buttonWithText('Verificar taxas com IA'));
    expect(geminiMock.checkChannelFees).toHaveBeenCalledWith(expect.stringContaining('id "shopee" — Shopee'));
    expect(text()).toContain('Shopee · Comissão %: 20 → 22');
    expect(text()).toContain('Fonte: https://seller.shopee.com.br/taxas');
    expect(text()).toContain('Mercado Livre · Comissão %: 18 → 19');
    expect(text()).toContain('1 sugestão(ões) sem fonte ou com valor inválido foram descartadas.');
    expect(text()).toContain('Páginas pesquisadas:');
    expect(writes).toHaveLength(0); // nada muda sem aprovação
    expect(html()).toMatchSnapshot();

    const row = (label: string) =>
      Array.from(document.querySelectorAll('div')).find(
        d => d.querySelector('p')?.textContent?.startsWith(label) && d.querySelector('button'),
      )!;
    await click(Array.from(row('Mercado Livre').querySelectorAll('button')).find(b => b.textContent === 'Recusar')!);
    expect(writes).toHaveLength(0);
    expect(text()).not.toContain('Mercado Livre · Comissão %');

    await click(Array.from(row('Shopee').querySelectorAll('button')).find(b => b.textContent === 'Aplicar')!);
    expect(writes).toHaveLength(1);
    expect(writes[0].path).toBe('costBases/loja-teste');
    const saved = writes[0].data.salesChannels as Array<{ id: string; commissionPct: number }>;
    expect(saved.map(c => [c.id, c.commissionPct])).toEqual([
      ['venda-direta', 0],
      ['instagram', 0],
      ['shopee', 22],
      ['mercado-livre', 18],
      ['ifood', 26.5],
      ['99food', 13],
    ]);
    expect(text()).toContain('Nenhuma mudança pendente nas taxas.');
  });
  it('mostra as sugestões de pesquisa do Google (obrigatório com a busca), separadas do app', async () => {
    geminiMock.checkChannelFees.mockResolvedValueOnce({
      text: '[]',
      sources: [],
      searchSuggestionsHtml: '<div class="google-sugestoes">taxas shopee 2026</div>',
    } as never);
    await loadCostBase();
    await click(buttonWithText('Verificar taxas com IA'));
    const host = document.querySelector('[aria-label="Sugestões de pesquisa do Google"]')!;
    expect(host.shadowRoot?.innerHTML).toContain('taxas shopee 2026');
    expect(text()).toContain('Nenhuma mudança pendente nas taxas.');
  });
  it('IA indisponível: avisa e não muda nada', async () => {
    const { writes } = await import('../test/firestoreMock');
    geminiMock.checkChannelFees.mockResolvedValueOnce(null);
    await loadCostBase();
    writes.length = 0;
    await click(buttonWithText('Verificar taxas com IA'));
    // Mostra o motivo resumido da falha, não um "IA indisponível" genérico.
    expect(text()).toContain(
      'IA indisponível: a busca com fontes do Google não está liberada (teste). Nada foi alterado.',
    );
    expect(writes).toHaveLength(0);
  });
});

describe('Base de Custos: faixas de atacado', () => {
  const load = async () => React.createElement((await import('./CostBase')).CostBaseSettings);
  it('mostra as faixas padrão e grava as editadas', async () => {
    const { writes } = await import('../test/firestoreMock');
    await show(await load());
    expect(document.body.textContent).toContain('Desconto de atacado (por quantidade)');
    expect(document.body.textContent).toContain('10–29 un');
    expect(document.body.textContent).toContain('100+ un');
    expect(html()).toMatchSnapshot();
    await type(document.querySelector('input[aria-label="Desconto da faixa 1"]')!, '12');
    writes.length = 0;
    await click(buttonWithText('Salvar Configurações'));
    const saved = writes.find(w => w.path.startsWith('costBases/'))!.data;
    expect(saved.wholesaleTiers).toEqual([
      { minQty: 10, discountPct: 12 },
      { minQty: 30, discountPct: 20 },
      { minQty: 100, discountPct: 30 },
    ]);
  });
});

// Etapa 8A, item 2 — Produtos: estados internos que a divisão de Products.tsx mexe
// (tabela, ordenação, janela de cadastro, edição com preço manual e pacote).
describe('Produtos (telas internas)', () => {
  const load = async () => React.createElement((await import('./Products')).Products);
  // Estacionamento item 9: produto vindo de trabalho mostra de qual calculadora é o custo, não "0 min · 0 materiais".
  it('item 9: cartão de produto de trabalho mostra "Custo da calculadora: [nome]"', async () => {
    const { fixtures } = await import('../test/fixtures');
    const p = fixtures.products[0];
    const saved = p.sourceJob;
    p.sourceJob = { kind: 'laser', id: 'job-1' };
    try {
      await show(await load());
      expect(document.body.textContent).toContain('Custo da calculadora: Corte a Laser');
    } finally {
      if (saved === undefined) delete p.sourceJob;
      else p.sourceJob = saved;
    }
  });
  // Etapa 8C, item 4: "Abrir produto" numa calculadora abre a janela do produto aqui.
  // Estacionamento item 4: abrir Produtos cria a cópia pública que falta, sem nenhum custo.
  it('cria a cópia pública do catálogo que falta, sem custos', async () => {
    const { writes } = await import('../test/firestoreMock');
    const { fixtures } = await import('../test/fixtures');
    const saved = fixtures.catalogProducts;
    fixtures.catalogProducts = [];
    try {
      writes.length = 0;
      const { Products } = await import('./Products');
      await show(<Products />);
      await act(() => new Promise(r => setTimeout(r, 1700)));
      const copias = writes.filter(w => w.path.startsWith('catalogProducts/'));
      expect(copias.length).toBeGreaterThan(0);
      for (const c of copias) {
        expect(c.op).toBe('set');
        for (const custo of [
          'materials',
          'productionTime',
          'packagingCost',
          'manualPrice',
          'jobCostUnit',
          'aiPriceAnalysis',
        ])
          expect(c.data).not.toHaveProperty(custo);
      }
      expect(copias.find(c => c.path === 'catalogProducts/chaveiro')!.data).toMatchObject({
        name: 'TESTE Chaveiro',
        storeId: 'loja-teste',
        showInCatalog: true,
      });
    } finally {
      fixtures.catalogProducts = saved;
    }
  });
  it('abre a janela do produto pedido pela calculadora', async () => {
    let opened = 0;
    const { Products } = await import('./Products');
    await show(<Products openProductId="chaveiro" onProductOpened={() => opened++} />);
    expect(document.body.textContent).toContain('Editar Produto');
    expect((field('Nome do Produto') as HTMLInputElement).value).toBe('TESTE Chaveiro');
    expect(opened).toBe(1);
  });
  // Correção de 26/10/2026 (caso real da Caneca Mágica): produto criado de trabalho mantém o custo e o sugerido
  // da calculadora ao abrir, editar e salvar; tempo e embalagem vêm preenchidos, travados e não são obrigatórios.
  // Correção de 26/10/2026: preço do trabalho com muitas casas (ex.: 38,535607…) travava o "Atualizar Produto"
  // (campo com step 0,01). Criar de trabalho, abrir e salvar sem mexer em nada tem que funcionar nas 5 calculadoras.
  it.each([
    ['laser', { cuttingTimeMin: 3, engravingTimeMin: 2, passes: 1 }],
    ['print3d', { postProcessHours: 0.25, packagingCost: 1.234 }],
    ['papelaria', { quantity: 3, assemblyTimeMin: 10, materials: [{ materialId: 'mdf', quantity: 1 }] }],
    ['cestas', { quantity: 3, assemblyTimeMin: 10, packagingCost: 1, items: [{ materialId: 'mdf', quantity: 1 }] }],
    ['sublimacao', { laborMinPerPiece: 5, packagingCost: 1.5, baseMode: 'stock', baseMaterialId: 'mdf', baseQty: 1 }],
  ] as const)('%s: produto criado de trabalho abre e salva sem mexer, em centavos', async (kind, extra) => {
    const { writes } = await import('../test/firestoreMock');
    const { fixtures } = await import('../test/fixtures');
    const { productFromJob } = await import('../lib/jobProduct');
    const { calcProductPricing } = await import('../lib/pricingEngine');
    const job = {
      id: `job-${kind}`,
      name: `TESTE ${kind}`,
      totalCostUnit: 19.267803611111113,
      unitPrice: 38.535607222222225,
      suggestedUnit: 38.535607222222225,
      ...extra,
    };
    const created = productFromJob(kind, job as never, { storeId: 'loja-teste', name: job.name, now: 'agora' });
    expect(created.manualPrice).toBe(38.54);
    expect(created.jobCostUnit).toBe(19.27);
    const product = { ...created, id: `prod-${kind}` };
    fixtures.products.push(product);
    try {
      const { Products } = await import('./Products');
      await show(<Products openProductId={product.id} />);
      const manual = field('Preço de Venda Manual') as HTMLInputElement;
      expect(manual.value).toBe('38.54');
      expect((document.getElementById('product-form') as HTMLFormElement).checkValidity()).toBe(true);
      writes.length = 0;
      await click(buttonWithText('Atualizar Produto'));
      const saved = writes.find(w => w.path === `products/${product.id}`)!.data;
      expect(saved.manualPrice).toBe(38.54);
      const pricing = calcProductPricing(saved as never, fixtures.materials as never, fixtures.costBases[0] as never);
      expect(pricing.totalCost).toBe(19.27);
      expect(pricing.suggestedPrice).toBe(38.54);
      expect(pricing.effectivePrice).toBe(38.54);
    } finally {
      fixtures.products.splice(fixtures.products.indexOf(product), 1);
    }
  });
  it('produto já gravado com preço de muitas casas: o campo abre em centavos e o formulário é válido', async () => {
    const { fixtures } = await import('../test/fixtures');
    const product = { ...fixtures.products[0], id: 'prod-casas', name: 'TESTE casas', manualPrice: 38.535607222222225 };
    fixtures.products.push(product);
    try {
      const { Products } = await import('./Products');
      await show(<Products openProductId="prod-casas" />);
      expect((field('Preço de Venda Manual') as HTMLInputElement).value).toBe('38.54');
      expect((document.getElementById('product-form') as HTMLFormElement).checkValidity()).toBe(true);
    } finally {
      fixtures.products.splice(fixtures.products.indexOf(product), 1);
    }
  });
  it('produto criado de trabalho: mesmo custo e sugerido da calculadora, também depois de editar e salvar', async () => {
    const { writes } = await import('../test/firestoreMock');
    const { fixtures } = await import('../test/fixtures');
    const { calcProductPricing } = await import('../lib/pricingEngine');
    const caneca = {
      id: 'caneca-magica',
      storeId: 'loja-teste',
      name: 'TESTE Caneca Mágica',
      category: '',
      categoryIds: [],
      materials: [{ materialId: 'mdf', quantity: 1 }],
      productionTime: 30,
      packagingCost: 2.5,
      finishingOptions: [],
      accessories: [],
      jobCostUnit: 29.46611388888889,
      jobSuggestedUnit: 58.93222777777778,
      sourceJob: { kind: 'sublimacao', id: 'sub-job-1' },
      manualPrice: null,
      catalogPrice: 58.93222777777778,
      showInCatalog: false,
    };
    fixtures.products.push(caneca);
    try {
      const { Products } = await import('./Products');
      await show(<Products openProductId="caneca-magica" />);
      const text = (document.body.textContent ?? '').replace(/\s/g, ' ');
      expect(text).toContain('Vem da calculadora: custo R$ 29,47 por unidade');
      const time = field('Tempo de Produção') as HTMLInputElement;
      expect(time.readOnly).toBe(true);
      expect(time.required).toBe(false);
      expect(time.value).toBe('30');
      expect((field('Custo de Embalagem') as HTMLInputElement).readOnly).toBe(true);
      writes.length = 0;
      await click(buttonWithText('Atualizar Produto'));
      const saved = writes.find(w => w.path === 'products/caneca-magica')!.data;
      expect(saved).toMatchObject({ jobCostUnit: 29.46611388888889, productionTime: 30, packagingCost: 2.5 });
      const pricing = calcProductPricing(saved as never, fixtures.materials as never, fixtures.costBases[0] as never);
      expect(pricing.totalCost).toBeCloseTo(29.46611388888889, 10);
      expect(pricing.suggestedPrice).toBeCloseTo(58.93222777777778, 10);
      expect(Number(saved.catalogPrice)).toBeCloseTo(58.93222777777778, 10);
    } finally {
      fixtures.products.splice(fixtures.products.indexOf(caneca), 1);
    }
  });
  it('tabela e ordenação por preço', async () => {
    await show(await load());
    await click(buttonWithIcon('table2'));
    expect(html()).toMatchSnapshot();
    await click(buttonWithText('Preço'));
    await click(buttonWithText('Preço'));
    expect(html()).toMatchSnapshot();
  });
  // Etapa 8B, item 6 — preço sugerido de cada produto em cada canal.
  it('preço sugerido por canal', async () => {
    await show(await load());
    await click(buttonWithIcon('columns-3'));
    expect(html()).toMatchSnapshot();
  });
  it('janela de novo produto', async () => {
    await show(await load());
    await click(buttonWithText('Novo Produto'));
    expect(html()).toMatchSnapshot();
  });
  // Estacionamento item 19: Kit com produtos já cadastrados, custos extras e montagem; grava custo, preço e materiais.
  it('item 19: monta um kit e grava custo, preço, desconto e materiais dos produtos', async () => {
    const { writes } = await import('../test/firestoreMock');
    writes.length = 0;
    await show(await load());
    await click(buttonWithText('Novo Produto'));
    await type(field('Nome do Produto'), 'TESTE Kit presente');
    const kitBox = Array.from(document.querySelectorAll('label')).find(l => l.textContent?.includes('é um Kit'))!;
    await click(kitBox.querySelector('input')!);
    await type(document.querySelector('select[aria-label="Produto do kit"]')!, 'chaveiro');
    await type(document.querySelector('input[aria-label="Quantidade no kit"]')!, '3');
    await click(buttonWithText('Adicionar'));
    await type(field('Custos extras do kit'), '6');
    await type(field('Tempo de montagem'), '10');
    await type(field('Desconto do kit'), '10');
    const status = () => document.querySelector('[role="status"]')?.textContent?.replace(/\s/g, ' ') ?? '';
    expect(status()).toContain('Custo do kit');
    expect(status()).toContain('Preço do kit');
    fireEvent.submit(document.querySelector('form#product-form')!);
    await act(() => new Promise(r => setTimeout(r, 0)));
    const saved = writes.find(w => w.op === 'add' && w.path === 'products')!.data;
    expect(saved).toMatchObject({
      isKit: true,
      kitItems: [{ productId: 'chaveiro', quantity: 3 }],
      kitDiscountPct: 10,
    });
    expect(saved.kitExtraCost).toBe(6);
    expect(saved.kitAssemblyMin).toBe(10);
    expect(Number(saved.kitCostUnit)).toBeGreaterThan(6);
    expect(Number(saved.kitPriceUnit)).toBeGreaterThan(0);
    // Materiais do chaveiro × 3 (para a baixa de estoque).
    expect(saved.materials).toEqual([
      { materialId: 'mdf', quantity: 0.30000000000000004 },
      { materialId: 'argola', quantity: 3 },
    ]);
  });
  it('edição: preço manual (reversa), pacote, material, acabamento e acessório', async () => {
    await show(await load());
    await click(buttonWithIcon('pen'));
    expect(html()).toMatchSnapshot();
    await type(field('Preço de Venda Manual'), '4');
    expect(html()).toMatchSnapshot();
    await type(field('Preço de Venda Manual'), '30');
    const pacote = Array.from(document.querySelectorAll('label')).find(l => l.textContent?.includes('é um pacote ('));
    await click(pacote!.querySelector('input')!);
    await type(document.querySelector('input[placeholder="Pesquisar material..."]')!, 'Fita');
    const fita = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Fita'));
    if (fita) await click(fita);
    const nomes = document.querySelectorAll('input[placeholder="Nome"]');
    await type(nomes[0], 'Brilho');
    await click(Array.from(document.querySelectorAll('button')).filter(b => b.textContent?.trim() === 'Adicionar')[0]);
    await type(nomes[1], 'Laço');
    await click(Array.from(document.querySelectorAll('button')).filter(b => b.textContent?.trim() === 'Adicionar')[1]);
    expect(html()).toMatchSnapshot();
  });
});

// Etapa 8B, item 0 — nomes do menu lateral e do menu de baixo do celular (a versão muda a cada build,
// por isso compara só os nomes). O código interno de cada aba (activeTab) não muda.
describe('Menu', () => {
  beforeAll(() => {
    // jsdom não tem matchMedia (o Layout usa para saber se o app está instalado).
    window.matchMedia ??= (query: string) =>
      ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList;
  });
  const load = async () => {
    const { Layout } = await import('./Layout');
    return (
      <Layout activeTab="dashboard" onTabChange={() => {}}>
        <div />
      </Layout>
    );
  };
  const labels = (selector: string) => Array.from(document.querySelectorAll(selector)).map(b => b.textContent?.trim());
  it('nomes do menu lateral e dos 5 itens do menu de baixo', async () => {
    await show(await load());
    expect(labels('aside nav button, nav.flex-col button')).toMatchSnapshot();
    expect(labels('nav[class*="md:hidden"] > button')).toMatchSnapshot();
  });

  // Etapa 8B, item 3 — "Calculadoras" abre o Corte a Laser e fica ativo em qualquer calculadora.
  it('Calculadoras: abre o Laser e fica ativo nas 4 calculadoras', async () => {
    const { Layout } = await import('./Layout');
    const onTabChange = vi.fn();
    await show(
      <Layout activeTab="print3d" onTabChange={onTabChange}>
        <div />
      </Layout>,
    );
    const side = Array.from(document.querySelectorAll('nav.flex-col button'));
    const calc = side.find(b => b.textContent?.trim() === 'Calculadoras')!;
    expect(calc.className).toContain('bg-neutral-900');
    expect(side.filter(b => b.className.includes('bg-neutral-900 text-white'))).toHaveLength(1);
    await click(calc);
    expect(onTabChange).toHaveBeenLastCalledWith('laser');
    const bottom = Array.from(document.querySelectorAll('nav[class*="md:hidden"] > button'));
    await click(bottom.find(b => b.textContent?.trim() === 'Histórico')!);
    expect(onTabChange).toHaveBeenLastCalledWith('history');
  });
});

describe('Guia Calculadoras', () => {
  it('abas das 5 calculadoras; a aberta fica marcada e o clique troca de calculadora', async () => {
    const { CalculatorsHub } = await import('./CalculatorsHub');
    const onChange = vi.fn();
    await show(
      <CalculatorsHub active="papelaria" onChange={onChange}>
        <p>conteúdo</p>
      </CalculatorsHub>,
    );
    const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
    expect(tabs.map(t => t.textContent?.trim())).toEqual([
      'Corte a Laser',
      'Impressão 3D',
      'Papelaria',
      'Cestas',
      'Sublimação',
    ]);
    expect(tabs.map(t => t.getAttribute('aria-selected'))).toEqual(['false', 'false', 'true', 'false', 'false']);
    await click(tabs[3]);
    expect(onChange).toHaveBeenLastCalledWith('cestas');
    await click(tabs[4]);
    expect(onChange).toHaveBeenLastCalledWith('sublimacao');
    expect(document.body.textContent).toContain('conteúdo');
  });
});

// Etapa 8D-1 — Calculadora de Sublimação.
describe('Sublimação', () => {
  const load = async () => React.createElement((await import('./SublimationCalculator')).SublimationCalculator);
  it('sem máquinas: botão para cadastrar as 4 da tabela', async () => {
    const { fixtures } = await import('../test/fixtures');
    const saved = fixtures.sublimationMachines;
    fixtures.sublimationMachines = [];
    try {
      await show(await load());
      expect(buttonWithText('Cadastrar as 4 máquinas da tabela')).toBeTruthy();
      expect(html()).toMatchSnapshot();
    } finally {
      fixtures.sublimationMachines = saved;
    }
  });
  it('máquinas cadastradas e janela de edição da 4 em 1', async () => {
    await show(await load());
    expect(html()).toMatchSnapshot();
    await click(document.querySelector('[aria-label="Editar Prensa 4 em 1"]')!);
    const heads = Array.from(document.querySelectorAll('select[aria-label="Linhas da tabela"]')) as HTMLSelectElement[];
    expect(heads.map(s => s.value)).toEqual(['', 'Prensa plana', 'Prensa de canetas', 'Prensa de canecas e copos']);
    expect(html()).toMatchSnapshot();
  });

  // Item 4: parte da máquina + produto preenchem temperatura, tempo e pressão (editáveis, não gravados).
  it('parâmetros: 4 em 1 (caneca e boné) e prensa plana', async () => {
    await show(await load());
    const value = (label: string) => (field(label) as HTMLInputElement).value;
    const values = () => [value('Temperatura'), value('Tempo (s)'), value('Pressão')];
    // A 4 em 1 vem primeiro (ordem alfabética) e já está selecionada.
    await type(field('Parte da máquina'), 'caneca');
    await type(field('Produto'), 'Caneca de porcelana');
    expect(values()).toEqual(['185', '200', 'Forte']);
    expect(html()).toMatchSnapshot();
    await type(field('Parte da máquina'), 'bone');
    expect(document.body.textContent).toContain('Sem referência na tabela; use os valores do fabricante.');
    expect(values()).toEqual(['', '', '']);
    await click(textElement('Prensa plana 38 × 38 cm (15")'));
    await type(field('Produto'), 'Tecidos em poliéster');
    expect(values()).toEqual(['230', '35', 'Forte']);
  });

  // 8D-2: exemplo feito à mão — caneca de porcelana (200 s) na Sun Special (350 W): base 12 + papel 2,40/2 +
  // energia 0,35 kW × (200 + 60) s × 0,79 + 5 min a R$ 25/h + 1,50 + 0,50 = R$ 17,30 por caneca.
  const byAria = (label: string) => document.querySelector(`[aria-label="${label}"]`)!;
  const costLine = () => textElement('Custo por peça').parentElement!.textContent;
  async function fillHandExample() {
    await click(textElement('Prensa de caneca Sun Special SSH-012A-1'));
    await type(field('Produto'), 'Caneca de porcelana');
    await click(buttonWithText('Valor avulso'));
    await type(byAria('Peça base (R$ por peça)'), '12');
    await type(field('Papel + tinta'), '2.4');
    await type(field('Peças por folha'), '2');
    expect((field('Aquecimento por leva') as HTMLInputElement).value).toBe('10'); // padrão
    await type(field('Peças na leva'), '10');
    await type(field('Mão de obra por peça'), '5');
    await type(field('Valor da hora'), '25');
    await type(field('Embalagem'), '1.5');
    await type(field('Outros custos'), '0.5');
    await type(field('Quantidade de peças'), '10');
    await type(field('Markup (% sobre o custo)'), '150');
  }

  // Item 3: custos da peça.
  it('custos da peça: exemplo à mão e peça base do estoque', async () => {
    await show(await load());
    await fillHandExample();
    expect(costLine()).toContain('17,30');
    expect(document.body.textContent).toContain('aquecimento rateado 60 s');
    expect(html()).toMatchSnapshot();
    // Peça base do estoque: MDF R$ 15,00 × 1 no lugar dos R$ 12,00 avulsos → custo sobe R$ 3,00.
    await click(buttonWithText('Do estoque'));
    await type(byAria('Peça base do estoque'), 'mdf');
    const baseLine = Array.from(document.querySelectorAll('p')).find(p => p.textContent?.startsWith('Peça base:'));
    expect(baseLine?.textContent).toMatch(/Peça base:\s*R\$\s*15,00 por peça/);
    expect(costLine()).toContain('20,30');
  });

  // Item 4: preço sugerido, canal, preço manual e lucro em cada canal (mesmos quadros das outras calculadoras).
  it('resultado: sugerido R$ 43,26 (Venda Direta) e R$ 66,57 (Shopee); preço manual R$ 40 → lucro R$ 22,70', async () => {
    await show(await load());
    await fillHandExample();
    const text = () => document.body.textContent!.replace(/\s/g, ' ');
    expect(text()).toContain('Custo / peça');
    expect(text()).toMatch(/R\$ 43,26/);
    expect(html()).toMatchSnapshot();
    await type(field('Canal de venda'), 'shopee');
    expect(text()).toMatch(/R\$ 66,57/);
    await type(field('Canal de venda'), 'venda-direta');
    await type(field('Seu preço por peça'), '40');
    expect(text()).toMatch(/R\$ 22,70/);
    expect(document.querySelector('[data-testid="channel-profit-table"]')).toBeTruthy();
    expect(html()).toMatchSnapshot();
  });

  // 8D-2, item 5: salvar trabalho e histórico.
  it('trabalhos salvos: histórico e salvar (limpa o formulário só quando grava)', async () => {
    await show(await load());
    const historyRow = Array.from(document.querySelectorAll('tbody tr')).find(tr =>
      tr.textContent?.includes('TESTE 10 canecas de porcelana'),
    )!;
    expect(historyRow.textContent).toContain('Prensa de caneca Sun Special SSH-012A-1 · Caneca');
    expect(historyRow.textContent).toContain('Caneca de porcelana');
    expect(historyRow.textContent?.replace(/\s/g, ' ')).toContain('R$ 40,00');
    await fillHandExample();
    await type(field('Seu preço por peça'), '40');
    // Sem nome: não grava, o preço digitado fica.
    await click(buttonWithText('Salvar Trabalho'));
    expect((field('Seu preço por peça') as HTMLInputElement).value).toBe('40');
    await type(field('Nome do trabalho'), 'Canecas da Maria');
    await click(buttonWithText('Salvar Trabalho'));
    expect((field('Nome do trabalho') as HTMLInputElement).value).toBe('');
    expect((field('Seu preço por peça') as HTMLInputElement).value).toBe('');
    expect(html()).toMatchSnapshot();
  });

  // Etapa 8C, item 4 — trabalho salvo vira produto (travas de 26/10/2026).
  const dialogText = () => (document.querySelector('[role="dialog"]')?.textContent ?? '').replace(/\s/g, ' ');
  it('8C item 4: trabalho salvo vira produto só com confirmação e nasce oculto no catálogo', async () => {
    const { writes } = await import('../test/firestoreMock');
    await show(await load());
    writes.length = 0;
    await click(buttonWithText('Virar produto'));
    // Trava 1: a janela mostra nome, custo, preço e categoria antes de criar.
    expect((field('Nome do produto') as HTMLInputElement).value).toBe('TESTE 10 canecas de porcelana');
    expect(field('Categoria')).toBeTruthy();
    expect(dialogText()).toContain('Custo por unidadeR$ 17,30');
    expect(dialogText()).toContain('Preço por unidadeR$ 40,00');
    expect(html()).toMatchSnapshot();
    await click(buttonWithText('Cancelar'));
    expect(writes).toHaveLength(0);
    await click(buttonWithText('Virar produto'));
    await click(buttonWithText('Confirmar e criar'));
    expect(writes).toEqual([
      {
        op: 'add',
        path: 'products',
        data: expect.objectContaining({
          name: 'TESTE 10 canecas de porcelana',
          jobCostUnit: 17.3,
          manualPrice: 40,
          catalogPrice: 40,
          showInCatalog: false, // trava 3
          sourceJob: { kind: 'sublimacao', id: 'sub-job-1' },
          materials: [],
          // Correção de 26/10/2026: tempo, embalagem e sugerido vêm do trabalho (5 min, R$ 1,50, R$ 43,26).
          productionTime: 5,
          packagingCost: 1.5,
          jobSuggestedUnit: 43.26,
        }),
      },
      // Trava 2: o trabalho guarda o id do produto.
      { op: 'update', path: 'sublimationJobs/sub-job-1', data: { productId: 'novo-id' } },
    ]);
  });
  it('8C item 4: já é produto → "Abrir produto" e "Atualizar preço do produto" com confirmação', async () => {
    const { writes } = await import('../test/firestoreMock');
    const { fixtures } = await import('../test/fixtures');
    const job = fixtures.sublimationJobs[0];
    job.productId = 'prod-caneca';
    const opened: string[] = [];
    try {
      const { SublimationCalculator } = await import('./SublimationCalculator');
      await show(<SublimationCalculator onOpenProduct={id => opened.push(id)} />);
      expect(document.body.textContent).not.toContain('Virar produto');
      await click(buttonWithText('Abrir produto'));
      expect(opened).toEqual(['prod-caneca']);
      writes.length = 0;
      await click(buttonWithText('Atualizar preço do produto'));
      expect(dialogText()).toContain('Novo preço (do trabalho)R$ 40,00');
      expect(writes).toHaveLength(0);
      await click(buttonWithText('Confirmar atualização'));
      expect(writes).toEqual([
        {
          op: 'update',
          path: 'products/prod-caneca',
          data: {
            productionTime: 5,
            packagingCost: 1.5,
            materials: [],
            jobCostUnit: 17.3,
            jobSuggestedUnit: 43.26,
            manualPrice: 40,
            catalogPrice: 40,
            updatedAt: expect.any(String),
          },
        },
      ]);
    } finally {
      delete job.productId;
    }
  });
  it('8C item 4: peça base do estoque fica vinculada ao produto (mesmo item e quantidade, para a baixa)', async () => {
    const { writes } = await import('../test/firestoreMock');
    const { fixtures } = await import('../test/fixtures');
    const job = fixtures.sublimationJobs[0];
    const before = { baseMode: job.baseMode, baseMaterialId: job.baseMaterialId, baseQty: job.baseQty };
    Object.assign(job, { baseMode: 'stock', baseMaterialId: 'mdf', baseQty: 2 });
    try {
      await show(await load());
      writes.length = 0;
      await click(buttonWithText('Virar produto'));
      await click(buttonWithText('Confirmar e criar'));
      const product = writes.find(w => w.path === 'products')!.data;
      expect(product.materials).toEqual([{ materialId: 'mdf', quantity: 2 }]);
      expect(product.jobCostUnit).toBe(17.3); // o custo do trabalho, em centavos
    } finally {
      Object.assign(job, before);
    }
  });
  it('8C item 4: "Salvar e criar produto" grava custo e preço do momento e abre a confirmação', async () => {
    const { writes } = await import('../test/firestoreMock');
    await show(await load());
    await fillHandExample();
    await type(field('Nome do trabalho'), 'Canecas da Ana');
    writes.length = 0;
    await click(buttonWithText('Salvar e criar produto'));
    expect(writes).toHaveLength(1);
    expect(writes[0].path).toBe('sublimationJobs');
    expect(Number(writes[0].data.totalCostUnit)).toBeCloseTo(17.3033, 4);
    expect(Number(writes[0].data.unitPrice)).toBeCloseTo(43.26, 2); // sugerido (sem preço manual)
    expect(dialogText()).toContain('Preço por unidadeR$ 43,26');
    await click(buttonWithText('Confirmar e criar'));
    expect(writes.map(w => `${w.op} ${w.path}`)).toEqual([
      'add sublimationJobs',
      'add products',
      'update sublimationJobs/novo-id',
    ]);
  });

  // Item 5: tabela de referência com busca (sem acento).
  it('tabela de referência: 40 linhas e busca', async () => {
    await show(await load());
    await click(buttonWithText('Tabela de referência'));
    expect(document.querySelectorAll('tbody tr')).toHaveLength(40);
    expect(document.body.textContent).toContain('40 de 40');
    await type(searchBox(), 'ceramica');
    const rows = Array.from(document.querySelectorAll('tbody tr')).map(tr => tr.textContent);
    expect(rows).toEqual([
      'Prensa planaAzulejo de cerâmica200 °C400 sMédia/fraca',
      'Prensa 3DAzulejo de cerâmica200 °C7 min—',
    ]);
    expect(html()).toMatchSnapshot();
    await type(searchBox(), 'xyz');
    expect(document.body.textContent).toContain('Nenhum produto encontrado.');
  });
});

// Matéria-prima: "Informar: preço por unidade / valor total pago" (urgente de 25/10/2026). O que é gravado continua
// igual: a mesma compra informada dos dois jeitos grava os mesmos valores.
describe('Matéria-prima: preço por unidade ou valor total pago', () => {
  const load = async () => React.createElement((await import('./Materials')).Materials);
  const submit = async () => {
    fireEvent.submit(document.querySelector('form')!);
    await flush();
  };
  const radio = (mode: string) => document.querySelector(`input[name="priceMode"][value="${mode}"]`)!;
  const preview = () => document.querySelector('[role="status"]')?.textContent?.replace(/\s/g, ' ').trim();
  const fillNew = async (price: string) => {
    await click(buttonWithText('Novo Insumo'));
    await type(field('Nome do Material'), 'TESTE Caneca branca');
    await type(field('Preço'), price);
    await type(field('Quantidade Comprada'), '10');
    await type(field('Estoque Atual'), '10');
  };
  const saved = (data: Record<string, unknown>) => ({
    purchasePrice: data.purchasePrice,
    purchaseQuantity: data.purchaseQuantity,
    unitCost: data.unitCost,
  });

  // Estacionamento item 10: estoque 0 fica no campo (antes virava vazio) e é gravado como 0.
  it('item 10: aceita estoque atual 0 no cadastro', async () => {
    const { writes } = await import('../test/firestoreMock');
    writes.length = 0;
    await show(await load());
    await fillNew('90');
    await type(field('Estoque Atual'), '0');
    expect((field('Estoque Atual') as HTMLInputElement).value).toBe('0');
    await click(radio('total'));
    await submit();
    expect(writes.find(w => w.path === 'materials')!.data.stockQuantity).toBe(0);
  });

  it('novo: sem escolha não grava; "por unidade" R$ 9 × 10 grava o mesmo que "total pago" R$ 90', async () => {
    const { writes } = await import('../test/firestoreMock');
    writes.length = 0;
    await show(await load());
    await fillNew('9');
    expect(document.body.textContent).toContain('obrigatório para salvar');
    expect(html()).toMatchSnapshot();
    await submit();
    expect(writes).toHaveLength(0); // sem escolher, não grava
    // O erro de antes fica visível: R$ 9 como total de 10 canecas = R$ 0,90 cada.
    await click(radio('total'));
    expect(preview()).toBe('= R$ 0,90 por unidade · total R$ 9,00');
    await click(radio('unit'));
    expect(preview()).toBe('= R$ 9,00 por unidade · total R$ 90,00');
    expect(html()).toMatchSnapshot();
    await submit();
    expect(writes).toHaveLength(1);
    const byUnit = saved(writes[0].data);
    expect(byUnit).toEqual({ purchasePrice: 90, purchaseQuantity: 10, unitCost: 9 });

    // A mesma compra informada como valor total pago.
    writes.length = 0;
    await fillNew('90');
    await click(radio('total'));
    expect(preview()).toBe('= R$ 9,00 por unidade · total R$ 90,00');
    await submit();
    expect(saved(writes[0].data)).toEqual(byUnit);
  });

  it('edição: abre em "valor total pago" com o valor gravado e grava igual (TESTE MDF: R$ 60 por 4)', async () => {
    const { writes } = await import('../test/firestoreMock');
    writes.length = 0;
    await show(await load());
    const mdfRow = Array.from(document.querySelectorAll('tr')).find(tr => tr.textContent?.includes('TESTE MDF 3mm'))!;
    await click(mdfRow.querySelector('svg.lucide-pen')!.closest('button')!);
    expect((radio('total') as HTMLInputElement).checked).toBe(true);
    expect((field('Valor total pago') as HTMLInputElement).value).toBe('60');
    expect(preview()).toBe('= R$ 15,00 por unidade · total R$ 60,00');
    await submit();
    expect(writes[0].op).toBe('update');
    expect(saved(writes[0].data)).toEqual({ purchasePrice: 60, purchaseQuantity: 4, unitCost: 15 });
  });
});

// Lista de Compras → Registrar Compra: o mesmo seletor. Seção 16.7 do checklist: 8 m de fita por R$ 40 = R$ 5,00/m,
// informado dos dois jeitos, grava o mesmo (purchasedPrice = total pago; unitCost = custo por metro).
// Estacionamento item 14: "Organizar categorias" mostra as grafias do texto livre e só grava com "Confirmar e gravar".
describe('Categorias: organizar as grafias do texto livre', () => {
  it('escolher a oficial e confirmar grava a categoria oficial no produto; antes disso, nada', async () => {
    const { writes } = await import('../test/firestoreMock');
    writes.length = 0;
    await show(React.createElement((await import('./Categories')).Categories));
    await click(buttonWithText('Produtos'));
    await click(buttonWithText('Organizar categorias'));
    const status = () => document.querySelector('[role="status"]')?.textContent?.trim();
    expect(document.body.textContent).toContain('"Presentes" ×1');
    expect(status()).toBe('0 produto(s) vão mudar');
    expect(buttonWithText('Confirmar e gravar').hasAttribute('disabled')).toBe(true);
    await type(document.querySelector('select[aria-label="Categoria para Presentes"]')!, 'cat-presentes');
    expect(status()).toBe('1 produto(s) vão mudar');
    expect(writes).toHaveLength(0);
    await click(buttonWithText('Confirmar e gravar'));
    const update = writes.find(w => w.path === 'products/chaveiro')!;
    expect(update.data).toMatchObject({ categoryIds: ['cat-presentes'], category: 'TESTE Presentes' });
    expect(writes.filter(w => w.path === 'categories')).toHaveLength(0);
  });
  it('"+ Nova categoria" cria a categoria e põe nos produtos', async () => {
    const { writes } = await import('../test/firestoreMock');
    writes.length = 0;
    await show(React.createElement((await import('./Categories')).Categories));
    await click(buttonWithText('Produtos'));
    await click(buttonWithText('Organizar categorias'));
    await type(document.querySelector('select[aria-label="Categoria para Presentes"]')!, '__nova__');
    expect(document.querySelector('[role="status"]')?.textContent).toContain('1 categoria(s) nova(s): Presentes');
    await click(buttonWithText('Confirmar e gravar'));
    expect(writes.find(w => w.path === 'categories')!.data).toMatchObject({ name: 'Presentes', scope: 'product' });
    expect(writes.find(w => w.path === 'products/chaveiro')!.data.categoryIds).toEqual(['cat-presentes', 'novo-id']);
  });
});

describe('Lista de Compras: preço por unidade ou valor total pago', () => {
  const load = async () => React.createElement((await import('./PurchaseList')).PurchaseList);
  const radio = (mode: string) => document.querySelector(`input[name="purchasePriceMode"][value="${mode}"]`)!;
  const preview = () => document.querySelector('[role="status"]')?.textContent?.replace(/\s/g, ' ').trim();
  const priceInput = () => document.querySelector('input[aria-label="Preço da compra"]') as HTMLInputElement;
  const register = async (mode: 'unit' | 'total', price: string) => {
    const { writes } = await import('../test/firestoreMock');
    writes.length = 0;
    await show(await load());
    await click(buttonWithText('Comprado'));
    await click(radio(mode));
    await type(priceInput(), price);
    const shown = preview();
    await click(buttonWithText('Confirmar'));
    const list = writes.find(w => w.path === 'purchaseList/compra-1')!.data;
    const mat = writes.find(w => w.path === 'materials/fita')!.data;
    return {
      shown,
      saved: { purchasedPrice: list.purchasedPrice, purchasedQty: list.purchasedQty, unitCost: mat.unitCost },
    };
  };

  it('abre sem modo e com o preço vazio; com preço e sem modo não registra; o modo traz a sugestão', async () => {
    const { writes } = await import('../test/firestoreMock');
    writes.length = 0;
    await show(await load());
    await click(buttonWithText('Comprado'));
    expect(priceInput().value).toBe('');
    expect(document.body.textContent).toContain('obrigatório para registrar com preço');
    expect(html()).toMatchSnapshot();
    await type(priceInput(), '40');
    await click(buttonWithText('Confirmar'));
    expect(writes).toHaveLength(0);
    // Sem nada digitado, escolher o modo preenche com o último preço pago (R$ 1,20/m × 8 m).
    await click(buttonWithText('Comprado'));
    await click(radio('unit'));
    expect(priceInput().value).toBe('1.2');
    expect(preview()).toBe('= R$ 1,20 por unidade · total R$ 9,60');
    await click(radio('total'));
    expect(priceInput().value).toBe('9.6');
  });

  it('16.7: "total pago" R$ 40 e "por unidade" R$ 5 por 8 m gravam o mesmo (R$ 40, 8 m, R$ 5,00/m)', async () => {
    const porTotal = await register('total', '40');
    expect(porTotal.shown).toBe('= R$ 5,00 por unidade · total R$ 40,00');
    expect(porTotal.saved).toEqual({ purchasedPrice: 40, purchasedQty: 8, unitCost: 5 });
    cleanup();
    const porUnidade = await register('unit', '5');
    expect(porUnidade.shown).toBe('= R$ 5,00 por unidade · total R$ 40,00');
    expect(porUnidade.saved).toEqual(porTotal.saved);
  });

  // Estacionamento item 7: a transação soma ao estoque do banco (não ao que a tela carregou) e não soma duas vezes.
  it('item 7: soma ao estoque atual do banco e não registra de novo uma compra já registrada', async () => {
    const { writes } = await import('../test/firestoreMock');
    const { fixtures } = await import('../test/fixtures');
    const fita = fixtures.materials.find(m => m.id === 'fita')!;
    const compra = fixtures.purchaseList.find(p => p.id === 'compra-1')!;
    const before = { stock: fita.stockQuantity, status: compra.status };
    const confirm = async () => {
      writes.length = 0;
      await show(await load());
      await click(buttonWithText('Comprado'));
      await click(radio('total'));
      await type(priceInput(), '40');
    };
    try {
      await confirm();
      fita.stockQuantity = 10; // outra pessoa mudou o estoque depois que a tela abriu (a tela ainda mostra 2)
      await click(buttonWithText('Confirmar'));
      expect(writes.find(w => w.path === 'materials/fita')!.data.stockQuantity).toBe(18);
      cleanup();
      fita.stockQuantity = before.stock;
      await confirm();
      compra.status = 'purchased'; // registrada por outra pessoa (ou clique duplo) antes deste clique
      await click(buttonWithText('Confirmar'));
      expect(writes).toHaveLength(0);
    } finally {
      fita.stockQuantity = before.stock;
      compra.status = before.status;
    }
  });
});

// Etapa 8C, item 3c — o catálogo mostra o preço no Pix, no crédito (Pix ÷ 0,95) ou os dois.
describe('Catálogo: preço no Pix, no crédito ou os dois', () => {
  // A moeda usa espaço não separável depois do R$.
  const text = () => (document.body.textContent ?? '').replace(/\s/g, ' ');
  it('a tela Catálogo grava a opção no documento da loja', async () => {
    const { writes } = await import('../test/firestoreMock');
    await show(React.createElement((await import('./Catalog')).Catalog));
    expect(text()).toContain('R$ 15,00 no Pix');
    writes.length = 0;
    await click(buttonWithText('Os dois'));
    expect(writes).toEqual([{ op: 'update', path: 'stores/loja-teste', data: { catalogPriceDisplay: 'ambos' } }]);
    expect(text()).toContain('R$ 15,00 no Pix · R$ 15,79 no crédito');
  });
  it('o catálogo público mostra os dois preços quando a loja escolhe "Os dois"', async () => {
    const { fixtures } = await import('../test/fixtures');
    const store = fixtures.stores[0];
    store.catalogPriceDisplay = 'ambos';
    try {
      await show(React.createElement((await import('./PublicCatalog')).PublicCatalog, { storeId: 'loja-teste' }));
      expect(text()).toContain('R$ 15,00no Pix');
      expect(text()).toContain('ou R$ 15,79 no crédito');
      expect(html()).toMatchSnapshot();
    } finally {
      delete store.catalogPriceDisplay;
    }
  });
});
