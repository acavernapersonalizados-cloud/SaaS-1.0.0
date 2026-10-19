import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { formatCurrency, formatPercent } from '../lib/utils';

interface SuggestedPriceProps {
  /** Markup sobre o custo (%). */
  markupPct: number;
  /** Margem real (%) do preço sugerido, depois das taxas/comissão. */
  realMarginPct?: number;
  suggestedUnit: number;
  suggestedBatch: number;
  quantity: number;
  /** Sufixo do preço por unidade ("/un", "/cesta", "/peça"). */
  unit: string;
  /** Aviso opcional logo abaixo do título (ex.: margem impossível). */
  warning?: React.ReactNode;
}

/** Quadro verde do preço sugerido das calculadoras. */
export function SuggestedPrice({
  markupPct,
  realMarginPct,
  suggestedUnit,
  suggestedBatch,
  quantity,
  unit,
  warning,
}: SuggestedPriceProps) {
  return (
    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
      <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Sugerido (markup {markupPct}%)</p>
      {warning}
      <p className="text-2xl font-black text-emerald-700">
        {formatCurrency(suggestedUnit)}
        <span className="text-sm font-medium">{unit}</span>
      </p>
      {realMarginPct !== undefined && suggestedUnit > 0 && (
        <p className="text-xs text-emerald-700 font-bold">Margem real: {formatPercent(realMarginPct)}</p>
      )}
      {quantity > 1 && (
        <p className="text-sm text-emerald-600 font-bold mt-0.5">{formatCurrency(suggestedBatch)} total</p>
      )}
    </div>
  );
}

interface ManualPriceCheckProps {
  manualPrice: number | null | undefined;
  profit: number;
  margin: number;
  /** Texto do aviso de prejuízo (só aparece quando o lucro é negativo). */
  children: React.ReactNode;
}

/** Quadro do preço digitado pelo usuário: lucro, margem e aviso de prejuízo. */
export function ManualPriceCheck({ manualPrice, profit, margin, children }: ManualPriceCheckProps) {
  if (manualPrice == null || !(manualPrice > 0)) return null;
  return (
    <div
      className={`p-4 rounded-xl border space-y-2 ${profit >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-red-50 border-red-100'}`}
    >
      <div className="flex items-center justify-between">
        <p className={`text-2xl font-black ${profit >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
          {formatCurrency(manualPrice)}
        </p>
        {profit >= 0 ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
        ) : (
          <AlertCircle className="w-5 h-5 text-red-500" />
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] text-neutral-400 font-bold uppercase">Lucro</p>
          <p className={`font-black text-sm ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatCurrency(profit)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-neutral-400 font-bold uppercase">Margem</p>
          <p className={`font-black text-sm ${margin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {margin.toFixed(1)}%
          </p>
        </div>
      </div>
      {profit < 0 && (
        <div className="flex items-start gap-2 p-2 bg-red-100 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <p className="text-xs text-red-700 font-medium">{children}</p>
        </div>
      )}
    </div>
  );
}
