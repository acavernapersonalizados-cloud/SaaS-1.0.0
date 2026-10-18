import React from 'react';
import { Loader2, Trash2 } from 'lucide-react';
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
