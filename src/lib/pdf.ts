import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Quote, Store } from '../types';
import { formatCurrency, formatPercent } from './utils';
import type { PickList } from './pickList';
import { formatQuantity } from './quantity';
import { formatLotDate } from './stockLots';
import { shippingLabel, shippingOf } from './shipping';

// ─── Helper: parse hex color to RGB ──────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return [20, 20, 20];
  return [r, g, b];
}

// ─── Helpers comuns aos 3 PDFs ────────────────────────────────────────────────

/** Cor principal da loja (cinza-escuro quando não há). */
function primaryColorOf(store: Store | null): [number, number, number] {
  return store?.primaryColor ? hexToRgb(store.primaryColor) : [20, 20, 20];
}

/** Total no crédito (Etapa 8C) ou 0 nos orçamentos anteriores, que saem como antes. */
const creditTotalOf = (quote: Quote) => Number(quote.creditTotal) || 0;

/** Linhas da tabela de itens: produto (com acabamentos/acessórios), quantidade, unitário e total. */
function itemRows(quote: Quote) {
  return quote.items.map(item => {
    const details = [
      item.finishingNames?.length ? `Acabamentos: ${item.finishingNames.join(', ')}` : '',
      item.accessoryNames?.length ? `Acessórios: ${item.accessoryNames.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    return [
      { content: item.productName + (details ? '\n' + details : ''), styles: { fontSize: 9 } },
      item.quantity.toString(),
      formatCurrency(item.unitPrice),
      formatCurrency(item.totalPrice),
    ];
  });
}

/**
 * Item 26: linha do frete na tabela (vazia sem frete). Cliente paga: o valor (já está no total). Frete grátis: "Grátis"
 * para o cliente; no interno, o valor como custo da loja.
 */
function shippingRows(quote: Quote, internal = false) {
  const label = shippingLabel(quote);
  if (!label) return [];
  const value =
    quote.shippingPaidBy === 'loja'
      ? internal
        ? `- ${formatCurrency(shippingOf(quote))} (custo)`
        : 'Grátis'
      : formatCurrency(shippingOf(quote));
  return [[{ content: label, styles: { fontStyle: 'italic' as const } }, '', '', value]];
}

/** Título de seção (12, preto) e prepara o texto seguinte (10, cinza). */
function sectionTitle(doc: jsPDF, title: string, x: number, y: number) {
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text(title, x, y);
  doc.setFontSize(10);
  doc.setTextColor(100);
}

/** Salva como "<prefixo>_<nome do cliente sem acentos/espaços>.pdf". */
function savePdf(doc: jsPDF, prefix: string, clientName: string) {
  const safeName = clientName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  doc.save(`${prefix}_${safeName}.pdf`);
}

// ─── Helper: add store header to any PDF ─────────────────────────────────────
// Adds logo (if available) + store name + contact info.
// Returns the Y position where content should start after the header.
async function addStoreHeader(doc: jsPDF, store: Store | null): Promise<number> {
  const primaryRgb = primaryColorOf(store);

  // Header background bar
  doc.setFillColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.rect(0, 0, 210, 30, 'F');

  // Try to add logo if available
  let logoAdded = false;
  if (store?.logo) {
    try {
      // Load image via fetch to get base64
      const response = await fetch(store.logo);
      const blob = await response.blob();
      const base64 = await new Promise<string>(resolve => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      doc.addImage(base64, 'WEBP', 5, 3, 24, 24);
      logoAdded = true;
    } catch {
      // Logo load failed — skip silently, keep text header
    }
  }

  // Store name in header
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  const nameX = logoAdded ? 33 : 14;
  doc.text(store?.fantasyName || store?.name || 'Ateliê', nameX, 14);

  if (store?.phone || store?.email) {
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    const contact = [store?.phone, store?.email].filter(Boolean).join(' · ');
    doc.text(contact, nameX, 21);
  }

  // Reset text color
  doc.setTextColor(0, 0, 0);

  return 38; // content starts at Y=38
}

// ─── Lista de separação (Estacionamento item 22) ─────────────────────────────
export const generatePickListPDF = async (
  title: string,
  subtitle: string,
  list: PickList,
  checked: string[],
  store: Store | null,
) => {
  const doc = new jsPDF();
  const startY = await addStoreHeader(doc, store);
  sectionTitle(doc, title, 14, startY);
  doc.text(subtitle, 14, startY + 6);
  const done = new Set(checked);
  const lotText = (l: PickList['lines'][number]) =>
    l.kind === 'product'
      ? 'produto pronto'
      : [
          ...l.lots.map(x => `${formatQuantity(x.quantity)} ${l.unit} · ${formatLotDate(x.expiresAt)}`),
          ...(l.short > 0 ? [`FALTA ${formatQuantity(l.short)} ${l.unit}`] : []),
        ].join('\n');
  autoTable(doc, {
    startY: startY + 12,
    head: [['', 'Separar', 'Quantidade', 'Lote a pegar', 'Para']],
    body: list.lines.map(l => [
      done.has(l.key) ? '[x]' : '[  ]',
      l.name,
      `${formatQuantity(l.quantity)} ${l.unit}`,
      lotText(l),
      { content: l.from.join('\n'), styles: { fontSize: 7 } },
    ]),
    theme: 'grid',
    styles: { fontSize: 9, valign: 'top' },
    columnStyles: { 0: { cellWidth: 10, halign: 'center' } },
    headStyles: { fillColor: primaryColorOf(store) },
  });
  if (list.warnings.length) {
    const y = ((doc as any).lastAutoTable?.finalY || 100) + 8;
    doc.setFontSize(9);
    doc.setTextColor(150, 80, 0);
    doc.text(
      list.warnings.map(w => `• ${w}`),
      14,
      y,
      { maxWidth: 182 },
    );
  }
  savePdf(doc, 'Separacao', title);
};

// ─── Client-facing quote PDF ──────────────────────────────────────────────────
export const generateClientPDF = async (quote: Quote, store: Store | null) => {
  try {
    const doc = new jsPDF();
    const startY = await addStoreHeader(doc, store);
    const primaryRgb = primaryColorOf(store);

    // Date + validity
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Data: ${new Date(quote.date).toLocaleDateString('pt-BR')}`, 14, startY);
    doc.text(`Validade: ${new Date(quote.expiryDate).toLocaleDateString('pt-BR')}`, 14, startY + 5);

    // Client Info
    sectionTitle(doc, 'Dados do Cliente', 14, startY + 17);
    doc.text(`Nome: ${quote.clientName}`, 14, startY + 24);
    if (quote.cnpj) {
      doc.text(`Documento: ${quote.cnpj}`, 14, startY + 29);
    }

    // Items table
    autoTable(doc, {
      startY: startY + 40,
      head: [['Produto', 'Quantidade', 'Valor Unitário', 'Total']],
      body: [...itemRows(quote), ...shippingRows(quote)],
      theme: 'striped',
      headStyles: { fillColor: primaryRgb as [number, number, number] },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 100;
    doc.setFontSize(14);
    doc.setTextColor(0);
    const credit = creditTotalOf(quote);
    doc.text(
      `${credit ? 'Total no Pix' : 'Total do Orçamento'}: ${formatCurrency(quote.totalAmount)}`,
      14,
      finalY + 15,
    );
    if (credit) doc.text(`No crédito: ${formatCurrency(credit)}`, 14, finalY + 22);

    savePdf(doc, 'Orcamento', quote.clientName);
  } catch (error) {
    console.error('Error generating Client PDF:', error);
    throw error;
  }
};

// ─── Internal (cost + margin) PDF ────────────────────────────────────────────
export const generateInternalPDF = async (quote: Quote, store: Store | null) => {
  try {
    const doc = new jsPDF();
    const startY = await addStoreHeader(doc, store);
    const primaryRgb = primaryColorOf(store);

    sectionTitle(doc, 'Orçamento Interno', 14, startY);

    doc.text(`Data: ${new Date(quote.date).toLocaleDateString('pt-BR')}`, 14, startY + 7);
    doc.text(`Canal: ${quote.channel}`, 14, startY + 12);

    sectionTitle(doc, 'Dados do Cliente', 14, startY + 24);
    doc.text(`Nome: ${quote.clientName}`, 14, startY + 31);
    if (quote.cnpj) doc.text(`Documento: ${quote.cnpj}`, 14, startY + 36);

    autoTable(doc, {
      startY: startY + 46,
      head: [['Produto', 'Qtd', 'Preço Unit.', 'Total Venda']],
      body: [...itemRows(quote), ...shippingRows(quote, true)],
      theme: 'striped',
      headStyles: { fillColor: primaryRgb as [number, number, number] },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 100;
    sectionTitle(doc, 'Resumo Financeiro', 14, finalY + 15);
    const credit = creditTotalOf(quote);
    doc.text(`${credit ? 'Total no Pix' : 'Total Geral'}: ${formatCurrency(quote.totalAmount)}`, 14, finalY + 22);
    doc.text(`Lucro Líquido Total: ${formatCurrency(quote.totalProfit)}`, 14, finalY + 27);
    doc.text(`Margem Média: ${formatPercent(quote.avgMargin)}`, 14, finalY + 32);
    if (credit) doc.text(`No crédito: ${formatCurrency(credit)} (cobre os 5% do cartão)`, 14, finalY + 37);

    savePdf(doc, 'Interno', quote.clientName);
  } catch (error) {
    console.error('Error generating Internal PDF:', error);
    throw error;
  }
};

// ─── Recibo (não é nota fiscal) ──────────────────────────────────────────────────────────────
export const generateInvoicePDF = async (quote: Quote, store: Store | null) => {
  try {
    const doc = new jsPDF();
    const startY = await addStoreHeader(doc, store);

    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('RECIBO', 14, startY);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 14, startY + 7);
    doc.text(
      `Número: ${Math.floor(Math.random() * 10000)
        .toString()
        .padStart(5, '0')}`,
      14,
      startY + 12,
    );

    // Emitente
    sectionTitle(doc, 'Emitente', 14, startY + 24);
    doc.text(`Razão Social: ${store?.name || 'Empresa Emissora'}`, 14, startY + 31);
    if (store?.fantasyName) doc.text(`Nome Fantasia: ${store.fantasyName}`, 14, startY + 36);
    if (store?.email) doc.text(`Email: ${store.email}`, 14, startY + 41);
    if (store?.phone) doc.text(`Telefone: ${store.phone}`, 14, startY + 46);

    // Destinatário
    sectionTitle(doc, 'Destinatário', 105, startY + 24);
    doc.text(`Nome: ${quote.clientName}`, 105, startY + 31);
    if (quote.cnpj) doc.text(`Documento: ${quote.cnpj}`, 105, startY + 36);

    autoTable(doc, {
      startY: startY + 56,
      head: [['Descrição', 'Quantidade', 'Valor Unitário', 'Valor Total']],
      body: [...itemRows(quote), ...shippingRows(quote)],
      theme: 'grid',
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0] },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 120;
    doc.setFontSize(14);
    doc.setTextColor(0);
    const credit = creditTotalOf(quote);
    doc.text(`${credit ? 'VALOR TOTAL NO PIX' : 'VALOR TOTAL'}: ${formatCurrency(quote.totalAmount)}`, 14, finalY + 15);
    if (credit) doc.text(`NO CRÉDITO: ${formatCurrency(credit)}`, 14, finalY + 22);

    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('Este recibo não é nota fiscal e não tem valor fiscal.', 14, 280);

    savePdf(doc, 'Recibo', quote.clientName);
  } catch (error) {
    console.error('Error generating Invoice PDF:', error);
    throw error;
  }
};
