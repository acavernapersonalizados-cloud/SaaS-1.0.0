// Guia "Calculadoras" (Etapa 8B, item 3): as 4 calculadoras continuam independentes; aqui só
// há a barra de abas acima da calculadora aberta. Trocar de aba é o mesmo que trocar pelo menu.
import React from 'react';
import { FileText, Gift, Printer, Zap } from 'lucide-react';
import { CALCULATOR_TABS } from '../lib/navigation';
import { cn } from '../lib/utils';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  laser: Zap,
  print3d: Printer,
  papelaria: FileText,
  cestas: Gift,
};

export function CalculatorsHub({
  active,
  onChange,
  children,
}: {
  active: string;
  onChange: (tab: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Calculadoras" className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {CALCULATOR_TABS.map(tab => {
          const Icon = ICONS[tab.id];
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all whitespace-nowrap',
                selected
                  ? 'bg-neutral-900 text-white border-neutral-900'
                  : 'bg-white text-neutral-500 border-neutral-200 hover:border-neutral-400 hover:text-neutral-900',
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>
      {children}
    </div>
  );
}
