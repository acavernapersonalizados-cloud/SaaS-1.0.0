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
      await type(field(name === 'Papelaria' ? 'Seu preco por unidade' : 'Seu preco por cesta'), '15');
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
});

// Etapa 8A, item 2 — Produtos: estados internos que a divisão de Products.tsx mexe
// (tabela, ordenação, janela de cadastro, edição com preço manual e pacote).
describe('Produtos (telas internas)', () => {
  const load = async () => React.createElement((await import('./Products')).Products);
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
    window.matchMedia ??= ((query: string) =>
      ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList);
  });
  const load = async () => {
    const { Layout } = await import('./Layout');
    return (
      <Layout activeTab="dashboard" onTabChange={() => {}}>
        <div />
      </Layout>
    );
  };
  const labels = (selector: string) =>
    Array.from(document.querySelectorAll(selector)).map(b => b.textContent?.trim());
  it('nomes do menu lateral e dos 5 itens do menu de baixo', async () => {
    await show(await load());
    expect(labels('aside nav button, nav.flex-col button')).toMatchSnapshot();
    expect(labels('nav[class*="md:hidden"] > button')).toMatchSnapshot();
  });
});
