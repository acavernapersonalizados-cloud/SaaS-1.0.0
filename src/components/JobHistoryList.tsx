import React from 'react';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { formatCurrency } from '../lib/utils';

interface SavedJob {
  id: string;
  name: string;
  quantity: number;
  manualPrice?: number | null;
}

interface JobHistoryListProps<T extends SavedJob> {
  title: string;
  emptyText: string;
  /** Títulos das colunas, na ordem: nome, extras, quantidade, preço e a coluna vazia do botão. */
  headers: string[];
  /** Células extras depois do nome (ex.: máquina e material no Corte a Laser). */
  extraCells?: (job: T) => React.ReactNode;
  /** Texto quando não há preço manual ("-" ou "—"). */
  noPrice: string;
  jobs: T[];
  loading: boolean;
  canDelete: boolean;
  deletingId: string | null;
  onDelete: (id: string) => void;
  /** Botões extras na última coluna, antes do excluir (Etapa 8C, item 4: virar produto). */
  rowActions?: (job: T) => React.ReactNode;
  /** Item 33, parte 2: abre o trabalho na calculadora para editar. */
  onEdit?: (job: T) => void;
}

/** Item 33, parte 2 (19/11/2026): trabalho aberto para editar; salvar grava nele. */
export type EditingJob = { id: string; name: string; createdAt?: string; productId?: string | null } | null;

export const editingJobOf = (job: { id: string; name: string; createdAt?: string; productId?: string | null }) => ({
  id: job.id,
  name: job.name,
  createdAt: job.createdAt,
  productId: job.productId ?? null,
});

export function EditJobButton({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Editar ${name}`}
      title="Editar"
      className="p-1.5 mr-1 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-all align-middle"
    >
      <Pencil className="w-3.5 h-3.5" />
    </button>
  );
}

/** Aviso fixo enquanto um trabalho salvo está aberto para editar. */
export function EditingJobBar({ job, onCancel }: { job: EditingJob; onCancel: () => void }) {
  if (!job) return null;
  return (
    <div
      role="status"
      className="fixed left-4 right-4 bottom-20 md:bottom-6 md:left-auto md:right-6 md:w-96 z-40 p-3 bg-neutral-900 text-white rounded-2xl shadow-lg flex items-center gap-3 text-xs"
    >
      <span className="flex-1 min-w-0">
        Editando "<b>{job.name}</b>": salvar grava neste trabalho.
        {job.productId ? ' Já é produto: depois use "Atualizar preço do produto".' : ''}
      </span>
      <button type="button" onClick={onCancel} className="px-3 py-1.5 bg-white/15 rounded-lg font-bold shrink-0">
        Cancelar
      </button>
    </div>
  );
}

/** Tabela de trabalhos salvos das calculadoras. */
export function JobHistoryList<T extends SavedJob>({
  title,
  emptyText,
  headers,
  extraCells,
  noPrice,
  jobs,
  loading,
  canDelete,
  deletingId,
  onDelete,
  rowActions,
  onEdit,
}: JobHistoryListProps<T>) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm space-y-4">
      <h2 className="text-base font-bold text-neutral-900">{title}</h2>
      {loading ? (
        <div className="animate-pulse h-24 bg-neutral-100 rounded-xl" />
      ) : jobs.length === 0 ? (
        <p className="py-10 text-center text-neutral-400 italic text-sm">{emptyText}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100">
                {headers.map(h => (
                  <th
                    key={h}
                    className="text-left py-2 pr-4 text-[10px] font-black text-neutral-400 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.map(job => (
                <tr key={job.id} className="border-b border-neutral-50 hover:bg-neutral-50 transition-colors">
                  <td className="py-3 pr-4 font-bold text-neutral-900">{job.name}</td>
                  {extraCells?.(job)}
                  <td className="py-3 pr-4 text-right text-neutral-600">{job.quantity}</td>
                  <td className="py-3 pr-4 font-bold text-neutral-900 text-right">
                    {job.manualPrice ? formatCurrency(job.manualPrice) : noPrice}
                  </td>
                  <td className="py-3 text-right">
                    {onEdit && <EditJobButton name={job.name} onClick={() => onEdit(job)} />}
                    {rowActions && <div className="inline-block align-middle mr-1">{rowActions(job)}</div>}
                    {canDelete && (
                      <button
                        onClick={() => onDelete(job.id)}
                        disabled={deletingId === job.id}
                        className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      >
                        {deletingId === job.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
