// Seções da janela de cadastro de produto (Etapa 8A): Precificação e Imagens & Catálogo.
// Só exibição e campos; o estado e as gravações ficam em Products.tsx.
import React from 'react';
import { CostBase, Product } from '../types';
import { formatCurrency, formatPercent } from '../lib/utils';
import { markupOf, ProductPricingResult, ReversePricingResult } from '../lib/pricingEngine';
import { channelsOf } from '../lib/channels';
import { ProductImageUpload } from './ProductImageUpload';
import { ChannelProfitTable } from './ChannelProfitTable';
import { AlertCircle, DollarSign, Image, Loader2, Sparkles } from 'lucide-react';

type SetProduct = React.Dispatch<React.SetStateAction<Partial<Product>>>;

export function ProductPricingSection({
  costs,
  newProduct,
  setNewProduct,
  modalPricing,
  reverseResult,
  setReversePriceInput,
  handleAnalyzePrice,
  aiLoading,
  aiAnalysis,
}: {
  costs: CostBase | null;
  newProduct: Partial<Product>;
  setNewProduct: SetProduct;
  modalPricing: ProductPricingResult;
  reverseResult: ReversePricingResult | null;
  setReversePriceInput: (value: string) => void;
  handleAnalyzePrice: () => void;
  aiLoading: boolean;
  aiAnalysis: string;
}) {
  return (
    <div className="space-y-4 pt-4 border-t-2 border-neutral-200">
      <div className="flex items-center gap-2">
        <DollarSign className="w-4 h-4 text-neutral-700" />
        <h3 className="text-sm font-black text-neutral-900 uppercase tracking-wider">Precificação</h3>
      </div>

      {/* Cost breakdown live */}
      {costs && (newProduct.materials?.length || 0) > 0 && (
        <div className="grid grid-cols-3 gap-2 p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
          <div className="text-center">
            <p className="text-[10px] text-neutral-400 font-bold uppercase">Material</p>
            <p className="text-sm font-black text-neutral-800">{formatCurrency(modalPricing.materialCost)}</p>
          </div>
          <div className="text-center border-x border-neutral-200">
            <p className="text-[10px] text-neutral-400 font-bold uppercase">Mão de Obra</p>
            <p className="text-sm font-black text-neutral-800">{formatCurrency(modalPricing.laborCost)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-neutral-400 font-bold uppercase">Embalagem</p>
            <p className="text-sm font-black text-neutral-800">{formatCurrency(modalPricing.packagingCost)}</p>
          </div>
          <div className="col-span-3 pt-2 border-t border-neutral-200 flex items-center justify-between">
            <span className="text-xs text-neutral-500 font-bold">Custo Total</span>
            <span className="text-base font-black text-neutral-900">{formatCurrency(modalPricing.totalCost)}</span>
          </div>
          <div className="col-span-3 flex items-center justify-between">
            <span className="text-xs text-emerald-600 font-bold">
              Sugerido (markup {formatPercent(markupOf(costs))} · margem {formatPercent(modalPricing.margin)})
            </span>
            {modalPricing.invalidProfitGoal ? (
              <span className="text-xs font-bold text-red-600 text-right">
                Meta de Lucro inválida ({formatPercent(markupOf(costs))}) — ajuste na Base de Custos
              </span>
            ) : (
              <span className="text-base font-black text-emerald-700">
                {formatCurrency(modalPricing.suggestedPrice)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Manual price input */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-neutral-600 uppercase tracking-wider">
          Preço de Venda Manual (opcional)
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-bold text-sm">R$</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={newProduct.manualPrice || ''}
            onChange={e => {
              const val = e.target.value ? Number(e.target.value) : null;
              setNewProduct(p => ({ ...p, manualPrice: val }));
              setReversePriceInput(e.target.value);
            }}
            className="w-full pl-12 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none font-bold text-lg"
            placeholder="0,00"
          />
        </div>
      </div>

      {/* ── PRECIFICAÇÃO REVERSA ── */}
      {reverseResult && (
        <div
          className={`p-4 rounded-2xl border space-y-3 ${reverseResult.profitStatus.bg} ${reverseResult.profitStatus.border}`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-black uppercase tracking-wider ${reverseResult.profitStatus.color}`}>
              {reverseResult.profitStatus.emoji} {reverseResult.profitStatus.label}
            </span>
            <span className={`text-xs font-bold ${reverseResult.profitStatus.color}`}>
              {reverseResult.margin.toFixed(1)}% margem
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[10px] text-neutral-500 font-bold uppercase">Custo</p>
              <p className="text-sm font-black text-neutral-800">{formatCurrency(reverseResult.totalCost)}</p>
            </div>
            <div>
              <p className="text-[10px] text-neutral-500 font-bold uppercase">Lucro</p>
              <p className={`text-sm font-black ${reverseResult.profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {formatCurrency(reverseResult.profit)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-neutral-500 font-bold uppercase">Markup</p>
              <p className="text-sm font-black text-neutral-800">{reverseResult.markup.toFixed(2)}x</p>
            </div>
          </div>
          {reverseResult.isBelowCost && (
            <div className="flex items-start gap-2 p-2.5 bg-red-100 rounded-xl">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 font-medium">
                Preço abaixo do custo! Prejuízo de {formatCurrency(Math.abs(reverseResult.profit))} por unidade. Mínimo:{' '}
                {formatCurrency(reverseResult.breakEvenPrice)}.
              </p>
            </div>
          )}
          <p className={`text-xs ${reverseResult.profitStatus.color} font-medium`}>
            {reverseResult.profitStatus.description}
          </p>
        </div>
      )}

      {/* Lucro do preço manual em cada canal (Etapa 8B, item 5) */}
      {costs && (
        <ChannelProfitTable
          price={newProduct.manualPrice}
          cost={modalPricing.totalCost}
          channels={channelsOf(costs)}
          markupPct={markupOf(costs)}
        />
      )}

      {/* AI button */}
      {newProduct.manualPrice && newProduct.manualPrice > 0 && newProduct.name && (
        <button
          type="button"
          onClick={handleAnalyzePrice}
          disabled={aiLoading}
          className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-violet-600 to-purple-700 text-white rounded-xl font-bold hover:from-violet-700 hover:to-purple-800 transition-all disabled:opacity-50 shadow-lg shadow-purple-100"
        >
          {aiLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Analisando...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" /> Analisar Lucro com IA
            </>
          )}
        </button>
      )}
      {aiAnalysis && (
        <div className="p-4 bg-violet-50 rounded-2xl border border-violet-100 space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-600" />
            <span className="text-xs font-bold text-violet-700 uppercase tracking-wider">Análise IA</span>
          </div>
          <p className="text-sm text-violet-900 leading-relaxed whitespace-pre-line">{aiAnalysis}</p>
        </div>
      )}
    </div>
  );
}

export function ProductCatalogSection({
  editingProduct,
  newProduct,
  setNewProduct,
  handleMainImageUpload,
  handleGalleryImageAdd,
  handleMainImageRemove,
  handleGalleryImageRemove,
  imageUploading,
}: {
  editingProduct: Product | null;
  newProduct: Partial<Product>;
  setNewProduct: SetProduct;
  handleMainImageUpload: (file: File) => Promise<void>;
  handleGalleryImageAdd: (file: File) => Promise<void>;
  handleMainImageRemove: () => void;
  handleGalleryImageRemove: (index: number) => void;
  imageUploading: boolean;
}) {
  return (
    <div className="space-y-4 pt-4 border-t-2 border-neutral-200">
      <div className="flex items-center gap-2">
        <Image className="w-4 h-4 text-neutral-700" />
        <h3 className="text-sm font-black text-neutral-900 uppercase tracking-wider">Imagens & Catálogo</h3>
      </div>

      {!editingProduct && (
        <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-700 font-medium">
          💡 Salve o produto primeiro para adicionar imagens.
        </div>
      )}

      {editingProduct && (
        <ProductImageUpload
          imageUrl={newProduct.imageUrl}
          thumbnailUrl={newProduct.thumbnailUrl}
          galleryImages={newProduct.galleryImages || []}
          onMainImageChange={handleMainImageUpload}
          onGalleryImageAdd={handleGalleryImageAdd}
          onMainImageRemove={handleMainImageRemove}
          onGalleryImageRemove={handleGalleryImageRemove}
          uploading={imageUploading}
        />
      )}

      <div className="space-y-1.5">
        <label className="text-xs font-bold text-neutral-600 uppercase tracking-wider">
          Descrição para o Catálogo (opcional)
        </label>
        <textarea
          rows={3}
          value={newProduct.description || ''}
          onChange={e => setNewProduct(p => ({ ...p, description: e.target.value || null }))}
          className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm resize-none"
          placeholder="Descreva o produto para os clientes..."
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-neutral-600 uppercase tracking-wider">
            Prazo de Produção (dias)
          </label>
          <input
            type="number"
            min="0"
            value={newProduct.leadTimeDays ?? ''}
            onChange={e => setNewProduct(p => ({ ...p, leadTimeDays: e.target.value ? Number(e.target.value) : null }))}
            className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm"
            placeholder="Ex: 7"
          />
        </div>
        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer mt-5">
            <input
              type="checkbox"
              checked={newProduct.showInCatalog !== false}
              onChange={e => setNewProduct(p => ({ ...p, showInCatalog: e.target.checked }))}
              className="w-4 h-4 rounded"
            />
            <span className="text-xs font-bold text-neutral-600">Exibir no catálogo</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={newProduct.showPrice !== false}
              onChange={e => setNewProduct(p => ({ ...p, showPrice: e.target.checked }))}
              className="w-4 h-4 rounded"
            />
            <span className="text-xs font-bold text-neutral-600">Exibir preço</span>
          </label>
        </div>
      </div>
    </div>
  );
}
