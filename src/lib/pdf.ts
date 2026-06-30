import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Quote, Store } from '../types';
import { formatCurrency, formatPercent } from './utils';

// ─── Helper: parse hex color to RGB ──────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return [20, 20, 20];
  return [r, g, b];
}

// ─── Helper: add store header to any PDF ─────────────────────────────────────
// Adds logo (if available) + store name + contact info.
// Returns the Y position where content should start after the header.
async function addStoreHeader(doc: jsPDF, store: Store | null): Promise<number> {
  const primaryRgb = store?.primaryColor ? hexToRgb(store.primaryColor) : [20, 20, 20];

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
      const base64 = await new Promise<string>((resolve) => {
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

// ─── Client-facing quote PDF ──────────────────────────────────────────────────
export const generateClientPDF = async (quote: Quote, store: Store | null) => {
  try {
    const doc = new jsPDF();
    const startY = await addStoreHeader(doc, store);
    const primaryRgb = store?.primaryColor ? hexToRgb(store.primaryColor) : [20, 20, 20];

    // Date + validity
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Data: ${new Date(quote.date).toLocaleDateString('pt-BR')}`, 14, startY);
    doc.text(`Validade: ${new Date(quote.expiryDate).toLocaleDateString('pt-BR')}`, 14, startY + 5);

    // Client Info
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text('Dados do Cliente', 14, startY + 17);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Nome: ${quote.clientName}`, 14, startY + 24);
    if (quote.cnpj) {
      doc.text(`Documento: ${quote.cnpj}`, 14, startY + 29);
    }

    // Items table
    autoTable(doc, {
      startY: startY + 40,
      head: [['Produto', 'Quantidade', 'Valor Unitário', 'Total']],
      body: quote.items.map(item => {
        const details = [
          item.finishingNames?.length ? `Acabamentos: ${item.finishingNames.join(', ')}` : '',
          item.accessoryNames?.length ? `Acessórios: ${item.accessoryNames.join(', ')}` : ''
        ].filter(Boolean).join('\n');
        return [
          { content: item.productName + (details ? '\n' + details : ''), styles: { fontSize: 9 } },
          item.quantity.toString(),
          formatCurrency(item.unitPrice),
          formatCurrency(item.totalPrice)
        ];
      }),
      theme: 'striped',
      headStyles: { fillColor: primaryRgb as [number, number, number] },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 100;
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text(`Total do Orçamento: ${formatCurrency(quote.totalAmount)}`, 14, finalY + 15);

    const safeName = quote.clientName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    doc.save(`Orcamento_${safeName}.pdf`);
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
    const primaryRgb = store?.primaryColor ? hexToRgb(store.primaryColor) : [20, 20, 20];

    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text('Orçamento Interno', 14, startY);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Data: ${new Date(quote.date).toLocaleDateString('pt-BR')}`, 14, startY + 7);
    doc.text(`Canal: ${quote.channel}`, 14, startY + 12);

    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text('Dados do Cliente', 14, startY + 24);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Nome: ${quote.clientName}`, 14, startY + 31);
    if (quote.cnpj) doc.text(`Documento: ${quote.cnpj}`, 14, startY + 36);

    autoTable(doc, {
      startY: startY + 46,
      head: [['Produto', 'Qtd', 'Preço Unit.', 'Total Venda']],
      body: quote.items.map(item => {
        const details = [
          item.finishingNames?.length ? `Acabamentos: ${item.finishingNames.join(', ')}` : '',
          item.accessoryNames?.length ? `Acessórios: ${item.accessoryNames.join(', ')}` : ''
        ].filter(Boolean).join('\n');
        return [
          { content: item.productName + (details ? '\n' + details : ''), styles: { fontSize: 9 } },
          item.quantity.toString(),
          formatCurrency(item.unitPrice),
          formatCurrency(item.totalPrice)
        ];
      }),
      theme: 'striped',
      headStyles: { fillColor: primaryRgb as [number, number, number] },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 100;
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text('Resumo Financeiro', 14, finalY + 15);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Total Geral: ${formatCurrency(quote.totalAmount)}`, 14, finalY + 22);
    doc.text(`Lucro Líquido Total: ${formatCurrency(quote.totalProfit)}`, 14, finalY + 27);
    doc.text(`Margem Média: ${formatPercent(quote.avgMargin)}`, 14, finalY + 32);

    const safeName = quote.clientName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    doc.save(`Interno_${safeName}.pdf`);
  } catch (error) {
    console.error('Error generating Internal PDF:', error);
    throw error;
  }
};

// ─── Invoice PDF ──────────────────────────────────────────────────────────────
export const generateInvoicePDF = async (quote: Quote, store: Store | null) => {
  try {
    const doc = new jsPDF();
    const startY = await addStoreHeader(doc, store);
    const primaryRgb = store?.primaryColor ? hexToRgb(store.primaryColor) : [20, 20, 20];

    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('NOTA FISCAL DE SERVIÇO / PRODUTO', 14, startY);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 14, startY + 7);
    doc.text(`Número: ${Math.floor(Math.random() * 10000).toString().padStart(5, '0')}`, 14, startY + 12);

    // Emitente
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text('Emitente', 14, startY + 24);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Razão Social: ${store?.name || 'Empresa Emissora'}`, 14, startY + 31);
    if (store?.fantasyName) doc.text(`Nome Fantasia: ${store.fantasyName}`, 14, startY + 36);
    if (store?.email) doc.text(`Email: ${store.email}`, 14, startY + 41);
    if (store?.phone) doc.text(`Telefone: ${store.phone}`, 14, startY + 46);

    // Destinatário
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text('Destinatário', 105, startY + 24);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Nome: ${quote.clientName}`, 105, startY + 31);
    if (quote.cnpj) doc.text(`Documento: ${quote.cnpj}`, 105, startY + 36);

    autoTable(doc, {
      startY: startY + 56,
      head: [['Descrição', 'Quantidade', 'Valor Unitário', 'Valor Total']],
      body: quote.items.map(item => {
        const details = [
          item.finishingNames?.length ? `Acabamentos: ${item.finishingNames.join(', ')}` : '',
          item.accessoryNames?.length ? `Acessórios: ${item.accessoryNames.join(', ')}` : ''
        ].filter(Boolean).join('\n');
        return [
          { content: item.productName + (details ? '\n' + details : ''), styles: { fontSize: 9 } },
          item.quantity.toString(),
          formatCurrency(item.unitPrice),
          formatCurrency(item.totalPrice)
        ];
      }),
      theme: 'grid',
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0] },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 120;
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text(`VALOR TOTAL DA NOTA: ${formatCurrency(quote.totalAmount)}`, 14, finalY + 15);

    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('Este documento é uma representação de nota fiscal gerada pelo sistema.', 14, 280);

    const safeName = quote.clientName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    doc.save(`NF_${safeName}.pdf`);
  } catch (error) {
    console.error('Error generating Invoice PDF:', error);
    throw error;
  }
};
