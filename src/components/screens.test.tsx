// @vitest-environment jsdom
// Caracterização das telas (Etapa 4B): guarda o HTML de cada tela afetada por B1–B4, em vários estados.
// Firebase, login, loja e avisos são simulados (src/test). Se o HTML mudar, o snapshot quebra.
import React from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
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
vi.mock('../services/gemini', () => {
  const none = async () => null;
  return {
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
  // Etapa 8C, item 4: "Abrir produto" numa calculadora abre a janela do produto aqui.
  it('abre a janela do produto pedido pela calculadora', async () => {
    let opened = 0;
    const { Products } = await import('./Products');
    await show(<Products openProductId="chaveiro" onProductOpened={() => opened++} />);
    expect(document.body.textContent).toContain('Editar Produto');
    expect((field('Nome do Produto') as HTMLInputElement).value).toBe('TESTE Chaveiro');
    expect(opened).toBe(1);
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
  it('edição: preço manual (reversa), pacote, material, acabamento e acessório', async () => {
    await show(await load());
    await click(buttonWithIcon('pen'));
    expect(html()).toMatchSnapshot();
    await type(field('Preço de Venda Manual'), '4');
    expect(html()).toMatchSnapshot();
    await type(field('Preço de Venda Manual'), '30');
    const pacote = Array.from(document.querySelectorAll('label')).find(l => l.textContent?.includes('pacote/kit'));
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
          jobCostUnit: 17.303302,
          manualPrice: 40,
          catalogPrice: 40,
          showInCatalog: false, // trava 3
          sourceJob: { kind: 'sublimacao', id: 'sub-job-1' },
          materials: [],
          productionTime: 0,
          packagingCost: 0,
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
          data: { jobCostUnit: 17.303302, manualPrice: 40, catalogPrice: 40, updatedAt: expect.any(String) },
        },
      ]);
    } finally {
      delete job.productId;
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
