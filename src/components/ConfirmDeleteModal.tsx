import React from 'react';
import { Loader2 } from 'lucide-react';

interface ConfirmDeleteModalProps {
  title: string;
  message: string;
  icon: React.ReactNode;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  /** Largura da janela (classe Tailwind). */
  panelWidthClass?: string;
}

/** Janela "Excluir …? / Confirmar Exclusão" das telas de cadastro. */
export function ConfirmDeleteModal({
  title,
  message,
  icon,
  isDeleting,
  onCancel,
  onConfirm,
  panelWidthClass = 'max-w-md',
}: ConfirmDeleteModalProps) {
  return (
    <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
      <div
        className={`bg-white w-full ${panelWidthClass} rounded-3xl shadow-2xl p-8 space-y-6 animate-in fade-in zoom-in duration-200`}
      >
        <div className="flex items-center gap-4 text-red-600">
          <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center">{icon}</div>
          <h3 className="text-xl font-bold">{title}</h3>
        </div>

        <p className="text-neutral-600 leading-relaxed">{message}</p>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 px-6 py-3 bg-neutral-100 text-neutral-900 rounded-xl font-bold hover:bg-neutral-200 transition-all disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-100 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Excluindo...
              </>
            ) : (
              'Confirmar Exclusão'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
