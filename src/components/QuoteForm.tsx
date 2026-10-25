// Partes da tela Precificação (Etapa 8A): cliente, itens e resumo. Só exibição e campos;
// o estado, as contas e a gravação do orçamento ficam em Pricing.tsx.
import React from 'react';
import { Client, QuoteItem } from '../types';
import { cn, formatCurrency, formatPercent } from '../lib/utils';
import { QuoteItemCalcResult } from '../lib/pricingEngine';
import { feeLabel, QUOTE_VALIDITY_DAYS } from '../lib/quoteFormat';
import {
  AlertCircle,
  ArrowRight,
  ChevronRight,
  FileText,
  Package,
  Plus,
  Receipt,
  Search,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';

export function QuoteClientCard({
  clientSearch,
  setClientSearch,
  setClientName,
  showClientList,
  setShowClientList,
  clients,
  handleSelectClient,
  clientType,
  setClientType,
  cnpj,
  setCnpj,
}: {
  clientSearch: string;
  setClientSearch: (value: string) => void;
  setClientName: (value: string) => void;
  showClientList: boolean;
  setShowClientList: (value: boolean) => void;
  clients: Client[];
  handleSelectClient: (client: Client) => void;
  clientType: 'PF' | 'PJ';
  setClientType: (value: 'PF' | 'PJ') => void;
  cnpj: string;
  setCnpj: (value: string) => void;
}) {
  return (
    <div className="bg-white p-8 rounded-[32px] shadow-sm border border-neutral-100 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-neutral-900 rounded-xl flex items-center justify-center">
          <Users className="w-5 h-5 text-white" />
        </div>
        <h2 className="text-xl font-bold text-neutral-900">Dados do Cliente</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2 relative">
          <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">
            Buscar ou Nome do Cliente
          </label>
          <div className="relative">
            <input
              type="text"
              value={clientSearch}
              onChange={e => {
                setClientSearch(e.target.value);
                setClientName(e.target.value);
                setShowClientList(true);
              }}
              onFocus={() => setShowClientList(true)}
              placeholder="Ex: João Silva ou Empresa ABC"
              className="w-full px-5 py-4 bg-neutral-50 border-2 border-transparent rounded-2xl text-neutral-900 placeholder-neutral-300 outline-none focus:bg-white focus:border-neutral-900 transition-all"
            />
            <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-300" />
          </div>

          {showClientList && clientSearch && (
            <div className="absolute z-50 w-full mt-2 bg-white border border-neutral-100 rounded-2xl shadow-2xl max-h-60 overflow-y-auto overflow-x-hidden">
              {clients
                .filter(c => (c.name || '').toLowerCase().includes(clientSearch.toLowerCase()))
                .map(client => (
                  <button
                    key={client.id}
                    onClick={() => handleSelectClient(client)}
                    className="w-full px-5 py-4 text-left hover:bg-neutral-50 flex items-center justify-between group transition-colors"
                  >
                    <div>
                      <p className="font-bold text-neutral-900 group-hover:text-black">{client.name}</p>
                      <p className="text-xs text-neutral-400">
                        {client.type} • {client.document || 'Sem documento'}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-neutral-200 group-hover:text-neutral-400 transition-all" />
                  </button>
                ))}
              {clients.filter(c => (c.name || '').toLowerCase().includes(clientSearch.toLowerCase())).length === 0 && (
                <div className="px-5 py-4 text-sm text-neutral-400 italic">
                  Nenhum cliente encontrado. Continue digitando para cadastrar novo.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Tipo de Cliente</label>
          <div className="flex bg-neutral-50 p-1 rounded-2xl border-2 border-transparent focus-within:border-neutral-900 transition-all">
            <button
              onClick={() => setClientType('PF')}
              className={cn(
                'flex-1 py-3 rounded-xl text-sm font-bold transition-all',
                clientType === 'PF' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-400 hover:text-neutral-600',
              )}
            >
              Pessoa Física
            </button>
            <button
              onClick={() => setClientType('PJ')}
              className={cn(
                'flex-1 py-3 rounded-xl text-sm font-bold transition-all',
                clientType === 'PJ' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-400 hover:text-neutral-600',
              )}
            >
              Pessoa Jurídica
            </button>
          </div>
        </div>

        {clientType === 'PJ' && (
          <div className="space-y-2 md:col-span-2">
            <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">CNPJ (Opcional)</label>
            <input
              type="text"
              value={cnpj}
              onChange={e => setCnpj(e.target.value)}
              placeholder="00.000.000/0000-00"
              className="w-full px-5 py-4 bg-neutral-50 border-2 border-transparent rounded-2xl text-neutral-900 placeholder-neutral-300 outline-none focus:bg-white focus:border-neutral-900 transition-all"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function QuoteItemsCard({
  quoteItems,
  calculateItemCosts,
  handleOpenNewItem,
  handleUpdateItemQuantity,
  handleEditItem,
  handleRemoveItem,
}: {
  quoteItems: QuoteItem[];
  calculateItemCosts: (item: QuoteItem) => QuoteItemCalcResult | null;
  handleOpenNewItem: () => void;
  handleUpdateItemQuantity: (id: string, delta: number) => void;
  handleEditItem: (item: QuoteItem) => void;
  handleRemoveItem: (index: number) => void;
}) {
  return (
    <div className="bg-white p-8 rounded-[32px] shadow-sm border border-neutral-100 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-neutral-900 rounded-xl flex items-center justify-center">
            <Package className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-xl font-bold text-neutral-900">Itens do Orçamento</h2>
        </div>
        <button
          onClick={handleOpenNewItem}
          className="px-4 py-2 bg-neutral-900 text-white rounded-xl text-sm font-bold hover:bg-black transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Adicionar Item
        </button>
      </div>

      <div className="space-y-4">
        {quoteItems.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-neutral-100 rounded-[32px] space-y-3">
            <div className="w-12 h-12 bg-neutral-50 rounded-full flex items-center justify-center mx-auto">
              <Package className="w-6 h-6 text-neutral-200" />
            </div>
            <p className="text-neutral-400 text-sm font-medium">Nenhum item adicionado ainda.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {quoteItems.map((item, index) => {
              const results = calculateItemCosts(item);
              return (
                <div
                  key={item.id}
                  className="group flex items-center justify-between p-5 bg-neutral-50 rounded-2xl border border-neutral-100 hover:border-neutral-200 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex flex-row sm:flex-col items-center gap-1 bg-white p-1 rounded-xl border border-neutral-100">
                      <button
                        onClick={() => handleUpdateItemQuantity(item.id, -1)}
                        className="p-1 hover:bg-neutral-50 rounded transition-colors"
                      >
                        <ArrowRight className="w-3 h-3 text-neutral-400 rotate-180" />
                      </button>
                      <div className="w-8 h-8 flex items-center justify-center font-black text-neutral-900 text-sm">
                        {item.quantity}
                      </div>
                      <button
                        onClick={() => handleUpdateItemQuantity(item.id, 1)}
                        className="p-1 hover:bg-neutral-50 rounded transition-colors"
                      >
                        <Plus className="w-3 h-3 text-neutral-400" />
                      </button>
                    </div>
                    <div>
                      <p className="font-bold text-neutral-900">{results?.productName}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
                        <span>{formatCurrency(results?.unitPrice || 0)} / un</span>
                        {(results?.finishingValue ?? 0) > 0 && (
                          <span className="px-1.5 py-0.5 bg-neutral-200 rounded text-neutral-600 font-bold">
                            +{formatCurrency(results?.finishingValue ?? 0)} acab.
                          </span>
                        )}
                        {(results?.accessoriesValue ?? 0) > 0 && (
                          <span className="px-1.5 py-0.5 bg-neutral-200 rounded text-neutral-600 font-bold">
                            +{formatCurrency(results?.accessoriesValue ?? 0)} aces.
                          </span>
                        )}
                        {(results?.wholesaleDiscountPct ?? 0) > 0 && (
                          <span className="px-1.5 py-0.5 bg-blue-100 rounded text-blue-700 font-bold">
                            atacado −{formatPercent(results?.wholesaleDiscountPct ?? 0)}
                          </span>
                        )}
                        {results?.wholesaleFloorApplied && (
                          <span className="px-1.5 py-0.5 bg-amber-100 rounded text-amber-700 font-bold">
                            no piso (custo × 1,30 + taxas)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-lg font-black text-neutral-900">{formatCurrency(results?.totalPrice || 0)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEditItem(item)}
                        className="p-2 text-neutral-400 hover:text-neutral-900 transition-colors"
                      >
                        <FileText className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleRemoveItem(index)}
                        className="p-2 text-neutral-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function QuoteSummary({
  totalAmount,
  quoteItems,
  handleGenerateQuote,
  isGenerating,
  channelFeePct,
  channelFixedFee,
  quoteError,
  quoteSuccess,
  avgMargin,
}: {
  totalAmount: number;
  quoteItems: QuoteItem[];
  handleGenerateQuote: () => void;
  isGenerating: boolean;
  channelFeePct: number;
  channelFixedFee: number;
  quoteError: string;
  quoteSuccess: string;
  avgMargin: number;
}) {
  return (
    <div className="space-y-8">
      <div className="bg-white p-8 rounded-[32px] shadow-sm border border-neutral-100 space-y-8 sticky top-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-neutral-900 rounded-xl flex items-center justify-center">
            <Receipt className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-xl font-bold text-neutral-900">Resumo</h2>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between text-sm">
            <span className="text-neutral-400 font-bold uppercase tracking-wider">Subtotal</span>
            <span className="text-neutral-900 font-black">{formatCurrency(totalAmount)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-neutral-400 font-bold uppercase tracking-wider">Itens</span>
            <span className="text-neutral-900 font-black">{quoteItems.length}</span>
          </div>
          <div className="h-px bg-neutral-100" />
          <div className="flex justify-between items-end">
            <span className="text-neutral-400 font-bold uppercase tracking-wider text-xs mb-1">Total Geral</span>
            <span className="text-3xl font-black text-neutral-900">{formatCurrency(totalAmount)}</span>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleGenerateQuote}
            // Etapa 8A: sem itens o botão continua clicável, para o clique explicar o que falta.
            disabled={isGenerating}
            className="w-full py-5 bg-neutral-900 text-white rounded-2xl font-black text-lg hover:bg-black transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-neutral-200"
          >
            {isGenerating ? (
              <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <FileText className="w-6 h-6" />
                Gerar Orçamento
              </>
            )}
          </button>
          <p className="text-[10px] text-center text-neutral-400 font-bold uppercase tracking-widest">
            Válido por {QUOTE_VALIDITY_DAYS} dias • taxas do canal: {feeLabel(channelFeePct, channelFixedFee)}
          </p>
          {quoteError && (
            <div
              role="alert"
              className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-sm font-medium flex items-center gap-3"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {quoteError}
            </div>
          )}
          {quoteSuccess && (
            <div
              role="status"
              className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl text-sm font-medium"
            >
              {quoteSuccess}
            </div>
          )}
        </div>

        {/* AI Insights in Sidebar */}
        {quoteItems.length > 0 && (
          <div className="pt-8 border-t border-neutral-100 space-y-4">
            <div className="flex items-center gap-2 text-neutral-900">
              <Sparkles className="w-4 h-4" />
              <span className="text-xs font-black uppercase tracking-widest">Insights IA</span>
            </div>
            <div className="p-4 bg-neutral-50 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-neutral-400 uppercase">Saúde do Preço</span>
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-full text-[10px] font-black uppercase',
                    avgMargin >= 30 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700',
                  )}
                >
                  {avgMargin >= 30 ? 'Excelente' : 'Atenção'}
                </span>
              </div>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Margem média de <span className="font-bold text-neutral-900">{formatPercent(avgMargin)}</span>.
                {avgMargin < 30
                  ? ' Considere revisar os custos dos acessórios para melhorar a rentabilidade.'
                  : ' Preço competitivo com ótima margem de lucro.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
