import React, { useSyncExternalStore } from 'react';
import { RefreshCw } from 'lucide-react';
import { applyAppUpdate, isAppOutdated, subscribeAppUpdate } from '../lib/appUpdate';

/**
 * Janela "Nova versão disponível" (Etapa 7.1). Cobre a tela inteira: numa versão antiga
 * nada pode ser salvo até atualizar, para não gravar dados com regras antigas.
 */
export function UpdateGate() {
  const outdated = useSyncExternalStore(subscribeAppUpdate, isAppOutdated, isAppOutdated);
  if (!outdated) return null;
  return (
    <div className="fixed inset-0 z-[300] bg-neutral-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div role="alertdialog" className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-8 space-y-5 text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 flex items-center justify-center">
          <RefreshCw className="w-7 h-7 text-emerald-600" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-neutral-900">Nova versão disponível</h2>
          <p className="text-sm text-neutral-500">
            O PrecificaAteliê foi atualizado. Para não gravar dados com a versão antiga, atualize antes de continuar.
          </p>
        </div>
        <button
          onClick={applyAppUpdate}
          className="w-full py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all"
        >
          Atualizar agora
        </button>
      </div>
    </div>
  );
}
