/**
 * ProductionDeadline — prazo de produção do pedido (Estacionamento item 20, aprovado em 28/10/2026).
 * Selo: "Prazo estimado dd/mm", "Vence hoje" (amarelo) ou "Atrasado N dia(s)" (vermelho). Pedido em produção sem
 * prazo (entrou antes do item 20) mostra o botão "Calcular prazo a partir de hoje".
 */
import React, { useState } from 'react';
import { Quote } from '../types';
import { deadlineStatus, shortDate } from '../lib/productionDeadline';
import { setProductionDeadlineFromToday } from '../services/automations';
import { useToast } from '../contexts/ToastContext';
import { CalendarClock, Loader2 } from 'lucide-react';

export function ProductionDeadline({ quote, today = new Date() }: { quote: Quote; today?: Date }) {
  const { addToast } = useToast();
  const [busy, setBusy] = useState(false);
  if (quote.status !== 'Em produção') return null;
  const s = deadlineStatus(quote.productionDueAt, today);

  if (s.kind === 'none')
    return (
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const fields = await setProductionDeadlineFromToday(quote);
          setBusy(false);
          if (fields.productionDueAt) addToast(`Prazo estimado: ${shortDate(fields.productionDueAt)}.`, 'success');
        }}
        className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border border-neutral-300 text-neutral-600 hover:bg-neutral-100 disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <CalendarClock className="w-3 h-3" />}
        Calcular prazo a partir de hoje
      </button>
    );

  const label =
    s.kind === 'late'
      ? `Atrasado ${s.daysLate} dia${s.daysLate === 1 ? '' : 's'} (prazo ${shortDate(s.dueAt)})`
      : s.kind === 'today'
        ? 'Vence hoje'
        : `Prazo estimado ${shortDate(s.dueAt)}`;
  const color =
    s.kind === 'late'
      ? 'bg-red-100 text-red-700'
      : s.kind === 'today'
        ? 'bg-amber-100 text-amber-800'
        : 'bg-neutral-100 text-neutral-600';
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${color}`}>
      <CalendarClock className="w-3 h-3" />
      {label}
    </span>
  );
}
