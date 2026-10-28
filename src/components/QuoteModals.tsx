// Janelas da tela Precificação (Etapa 8A): adicionar/editar item e orçamento gerado.
// Só exibição e campos; o estado, as contas e a gravação ficam em Pricing.tsx.
import React from 'react';
import { Product, Quote, Store } from '../types';
import { cn, formatCurrency, formatPercent } from '../lib/utils';
import { MAX_CHANNEL_FEE_PERCENT, MAX_MARKUP_PERCENT, QuoteItemCalcResult } from '../lib/pricingEngine';
import { feeLabel } from '../lib/quoteFormat';
import { AlertCircle, CheckCircle2, Download, FileText, Plus, Sparkles, X } from 'lucide-react';

/** O gerador de PDF (jsPDF, ~400 KB) só é baixado quando um PDF é pedido. */
const loadPdf = () => import('../lib/pdf');

type ItemDraft = {
  productId: string;
  quantity: number;
  selectedFinishingIds: string[];
  selectedAccessoryIds: string[];
  customMarkup?: number;
  /** Estacionamento item 18: preço manual por unidade (Pix). */
  manualUnitPrice?: number | null;
};

export function AddItemModal({
  editingItemId,
  setIsAddingItem,
  products,
  selectedProduct,
  selectedProductId,
  setSelectedProductId,
  quantity,
  setQuantity,
  customMarkup,
  setCustomMarkup,
  manualUnitPrice,
  setManualUnitPrice,
  selectedFinishes,
  setSelectedFinishes,
  selectedAccessories,
  setSelectedAccessories,
  currentItemResults,
  calculateItemCosts,
  handleAddItem,
}: {
  editingItemId: string | null;
  setIsAddingItem: (value: boolean) => void;
  products: Product[];
  selectedProduct: Product | undefined;
  selectedProductId: string;
  setSelectedProductId: (value: string) => void;
  quantity: number;
  setQuantity: (value: number) => void;
  customMarkup: number | null;
  setCustomMarkup: (value: number | null) => void;
  manualUnitPrice: number | null;
  setManualUnitPrice: (value: number | null) => void;
  selectedFinishes: string[];
  setSelectedFinishes: React.Dispatch<React.SetStateAction<string[]>>;
  selectedAccessories: string[];
  setSelectedAccessories: React.Dispatch<React.SetStateAction<string[]>>;
  currentItemResults: QuoteItemCalcResult | null;
  calculateItemCosts: (item: ItemDraft) => QuoteItemCalcResult | null;
  handleAddItem: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl p-8 space-y-8 animate-in fade-in zoom-in duration-300 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-neutral-900 rounded-xl flex items-center justify-center">
              {editingItemId ? <FileText className="w-5 h-5 text-white" /> : <Plus className="w-5 h-5 text-white" />}
            </div>
            <h2 className="text-xl font-bold text-neutral-900">{editingItemId ? 'Editar Item' : 'Adicionar Item'}</h2>
          </div>
          <button
            onClick={() => setIsAddingItem(false)}
            className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-neutral-400" />
          </button>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Produto</label>
            <select
              value={selectedProductId}
              onChange={e => setSelectedProductId(e.target.value)}
              className="w-full px-5 py-4 bg-neutral-50 border-2 border-transparent rounded-2xl text-neutral-900 outline-none focus:bg-white focus:border-neutral-900 transition-all"
            >
              <option value="">Selecione um produto</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Quantidade</label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={e => setQuantity(Number(e.target.value))}
                className="w-full px-5 py-4 bg-neutral-50 border-2 border-transparent rounded-2xl text-neutral-900 outline-none focus:bg-white focus:border-neutral-900 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">
                Markup personalizado (% sobre o custo)
              </label>
              <input
                type="number"
                min={0}
                max={MAX_MARKUP_PERCENT}
                value={customMarkup !== null ? customMarkup : ''}
                onChange={e => setCustomMarkup(e.target.value === '' ? null : Number(e.target.value))}
                placeholder="Padrão"
                className="w-full px-5 py-4 bg-neutral-50 border-2 border-transparent rounded-2xl text-neutral-900 outline-none focus:bg-white focus:border-neutral-900 transition-all"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">
                Preço manual {selectedProduct?.isPackage ? 'por pacote' : 'por unidade'} — no Pix (opcional)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={manualUnitPrice ?? ''}
                onChange={e =>
                  setManualUnitPrice(
                    e.target.value === '' || Number(e.target.value) <= 0 ? null : Number(e.target.value),
                  )
                }
                placeholder={
                  currentItemResults
                    ? `Calculado: ${formatCurrency(currentItemResults.suggestedUnitPrice)}`
                    : 'Calculado'
                }
                className="w-full px-5 py-4 bg-neutral-50 border-2 border-transparent rounded-2xl text-neutral-900 outline-none focus:bg-white focus:border-neutral-900 transition-all"
              />
              <p className="text-[11px] text-neutral-400 ml-1">
                É o preço final: sem desconto de atacado e já com acabamentos e acessórios. No crédito = Pix ÷ 0,95.
              </p>
            </div>
          </div>

          {selectedProduct && selectedProduct.finishingOptions && selectedProduct.finishingOptions.length > 0 && (
            <div className="space-y-3">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Acabamentos</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {selectedProduct.finishingOptions.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setSelectedFinishes(prev =>
                        prev.includes(opt.id) ? prev.filter(id => id !== opt.id) : [...prev, opt.id],
                      );
                    }}
                    className={cn(
                      'p-4 rounded-2xl border-2 text-left transition-all flex items-center justify-between group',
                      selectedFinishes.includes(opt.id)
                        ? 'border-neutral-900 bg-neutral-900 text-white'
                        : 'border-neutral-100 bg-neutral-50 text-neutral-600 hover:border-neutral-200',
                    )}
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-bold">{opt.name}</p>
                      <p
                        className={cn(
                          'text-[10px]',
                          selectedFinishes.includes(opt.id) ? 'text-neutral-400' : 'text-neutral-400',
                        )}
                      >
                        +{formatCurrency(opt.additionalValue)}
                      </p>
                    </div>
                    {selectedFinishes.includes(opt.id) && <CheckCircle2 className="w-4 h-4" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedProduct && selectedProduct.accessories && selectedProduct.accessories.length > 0 && (
            <div className="space-y-3">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Acessórios</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {selectedProduct.accessories.map(acc => (
                  <button
                    key={acc.id}
                    onClick={() => {
                      setSelectedAccessories(prev =>
                        prev.includes(acc.id) ? prev.filter(id => id !== acc.id) : [...prev, acc.id],
                      );
                    }}
                    className={cn(
                      'p-4 rounded-2xl border-2 text-left transition-all flex items-center justify-between group',
                      selectedAccessories.includes(acc.id)
                        ? 'border-neutral-900 bg-neutral-900 text-white'
                        : 'border-neutral-100 bg-neutral-50 text-neutral-600 hover:border-neutral-200',
                    )}
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-bold">{acc.name}</p>
                      <p
                        className={cn(
                          'text-[10px]',
                          selectedAccessories.includes(acc.id) ? 'text-neutral-400' : 'text-neutral-400',
                        )}
                      >
                        +{formatCurrency(acc.additionalValue)}
                      </p>
                    </div>
                    {selectedAccessories.includes(acc.id) && <CheckCircle2 className="w-4 h-4" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {currentItemResults?.invalidMargin && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-sm font-medium flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />A taxa do canal ({currentItemResults.platformFee}%) chega a{' '}
            {MAX_CHANNEL_FEE_PERCENT}%: não existe preço possível. Troque o canal.
          </div>
        )}

        <div className="pt-6 border-t border-neutral-100 flex items-center justify-between">
          <div className="text-left">
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Total do Item</p>
            <p className="text-2xl font-black text-neutral-900">
              {formatCurrency(
                calculateItemCosts({
                  productId: selectedProductId,
                  quantity,
                  selectedFinishingIds: selectedFinishes,
                  selectedAccessoryIds: selectedAccessories,
                  customMarkup: customMarkup !== null ? customMarkup : undefined,
                  manualUnitPrice,
                })?.totalPrice || 0,
              )}
            </p>
            {currentItemResults && !currentItemResults.invalidMargin && currentItemResults.totalPrice > 0 && (
              <p className="text-xs font-bold text-emerald-700">
                Markup {formatPercent(currentItemResults.markup)} · margem real{' '}
                {formatPercent(currentItemResults.margin)} · lucro {formatCurrency(currentItemResults.itemProfit)}
              </p>
            )}
            {currentItemResults?.manualUnitPrice != null && currentItemResults.belowCost && (
              <p role="alert" className="text-xs font-bold text-red-700">
                Abaixo do custo: prejuízo de{' '}
                {formatCurrency(-currentItemResults.itemProfit / currentItemResults.quantity)} por unidade.
              </p>
            )}
            {currentItemResults?.manualUnitPrice != null &&
              !currentItemResults.belowCost &&
              currentItemResults.belowGoal && (
                <p role="alert" className="text-xs font-bold text-amber-700">
                  Abaixo da meta: o sugerido é {formatCurrency(currentItemResults.suggestedUnitPrice)}.
                </p>
              )}
            {currentItemResults && currentItemResults.wholesaleDiscountPct > 0 && (
              <p className="text-xs font-bold text-blue-700">
                Atacado: −{formatPercent(currentItemResults.wholesaleDiscountPct)} pela quantidade (varejo{' '}
                {formatCurrency(currentItemResults.retailBasePrice)}/un)
              </p>
            )}
            {currentItemResults?.wholesaleFloorApplied && (
              <p className="text-xs font-bold text-amber-700">
                O desconto passaria do piso (custo × 1,30 + taxas): preço mantido no piso de{' '}
                {formatCurrency(currentItemResults.basePrice)}/un.
              </p>
            )}
          </div>
          <button
            onClick={handleAddItem}
            disabled={!selectedProductId || !!currentItemResults?.invalidMargin}
            className="px-8 py-4 bg-neutral-900 text-white rounded-2xl font-black hover:bg-black transition-all disabled:opacity-50"
          >
            {editingItemId ? 'Salvar Alterações' : 'Confirmar Item'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function GeneratedQuoteModal({
  generatedQuote,
  setShowQuoteModal,
  activeStore,
  addToast,
  handleFinishQuote,
}: {
  generatedQuote: Quote;
  setShowQuoteModal: (value: boolean) => void;
  activeStore: Store;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
  handleFinishQuote: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="bg-white w-full max-w-4xl rounded-[32px] shadow-2xl p-10 space-y-10 animate-in fade-in zoom-in duration-300 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-neutral-900 rounded-2xl flex items-center justify-center text-white font-black text-2xl">
              Q
            </div>
            <div>
              <h2 className="text-3xl font-black text-neutral-900">Orçamento Gerado</h2>
              <p className="text-sm text-neutral-400 font-bold uppercase tracking-widest mt-1">
                Válido até {new Date(generatedQuote.expiryDate).toLocaleDateString()}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowQuoteModal(false)}
            className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-neutral-400" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <div className="md:col-span-2 space-y-8">
            <div className="space-y-4">
              <h3 className="text-xs font-black text-neutral-400 uppercase tracking-widest">Itens do Orçamento</h3>
              <div className="border border-neutral-100 rounded-2xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-neutral-50 border-b border-neutral-100">
                    <tr>
                      <th className="px-5 py-3 text-[10px] font-black text-neutral-400 uppercase">Item</th>
                      <th className="px-5 py-3 text-[10px] font-black text-neutral-400 uppercase text-center">Qtd</th>
                      <th className="px-5 py-3 text-[10px] font-black text-neutral-400 uppercase text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {generatedQuote.items.map((item, i) => (
                      <tr key={i}>
                        <td className="px-5 py-4">
                          <p className="font-bold text-neutral-900 text-sm">{item.productName}</p>
                          <p className="text-[10px] text-neutral-400">Unitário: {formatCurrency(item.unitPrice)}</p>
                        </td>
                        <td className="px-5 py-4 text-center font-bold text-neutral-900 text-sm">{item.quantity}</td>
                        <td className="px-5 py-4 text-right font-black text-neutral-900 text-sm">
                          {formatCurrency(item.totalPrice)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-6 bg-neutral-50 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-neutral-900 mb-2">
                <Sparkles className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Descrição Inteligente</span>
              </div>
              <p className="text-sm text-neutral-600 leading-relaxed italic">
                "
                {generatedQuote.description ||
                  'Este orçamento foi cuidadosamente calculado para oferecer o melhor custo-benefício para o seu projeto.'}
                "
              </p>
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-neutral-900 p-8 rounded-[32px] text-white space-y-6">
              <h3 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Resumo Financeiro</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-neutral-400">Total Bruto</span>
                  <span className="font-black text-lg">{formatCurrency(generatedQuote.totalAmount)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-neutral-400">Canal ({generatedQuote.channel})</span>
                  <span className="font-bold">
                    {feeLabel(generatedQuote.platformFee ?? 0, generatedQuote.channelFixedFee ?? 0)}
                  </span>
                </div>
                <div className="h-px bg-white/10" />
                <div className="flex justify-between items-end">
                  <span className="text-xs text-neutral-400 mb-1">Total no Pix</span>
                  <span className="text-3xl font-black text-white">{formatCurrency(generatedQuote.totalAmount)}</span>
                </div>
                {(generatedQuote.creditTotal ?? 0) > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-neutral-400">No crédito</span>
                    <span className="font-black text-lg">{formatCurrency(generatedQuote.creditTotal ?? 0)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={async () => {
                  try {
                    // Estacionamento item 8: a mensagem só aparece depois de o PDF ficar pronto (ou falhar).
                    await (await loadPdf()).generateClientPDF(generatedQuote, activeStore);
                    addToast('PDF do Cliente gerado com sucesso!', 'success');
                  } catch (error) {
                    addToast('Erro ao gerar PDF do Cliente', 'error');
                  }
                }}
                className="w-full py-4 bg-neutral-100 text-neutral-900 rounded-2xl font-black text-sm hover:bg-neutral-200 transition-all flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                Baixar PDF Cliente
              </button>
              <button
                onClick={async () => {
                  try {
                    await (await loadPdf()).generateInternalPDF(generatedQuote, activeStore);
                    addToast('PDF Interno gerado com sucesso!', 'success');
                  } catch (error) {
                    addToast('Erro ao gerar PDF Interno', 'error');
                  }
                }}
                className="w-full py-4 bg-neutral-50 text-neutral-400 rounded-2xl font-bold text-xs hover:bg-neutral-100 transition-all flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Relatório Interno
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-8 border-t border-neutral-100 sticky -bottom-10 -mx-10 -mb-10 px-10 pb-10 bg-white">
          <button
            onClick={handleFinishQuote}
            className="px-10 py-4 bg-neutral-900 text-white rounded-2xl font-black text-lg hover:bg-black transition-all shadow-xl shadow-neutral-200"
          >
            Concluir e Novo
          </button>
        </div>
      </div>
    </div>
  );
}
