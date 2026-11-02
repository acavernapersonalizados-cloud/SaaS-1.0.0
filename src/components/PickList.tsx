import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Material, Product, Quote, StockReservation, Store } from '../types';
import { cn } from '../lib/utils';
import { buildPickList, PickList } from '../lib/pickList';
import { formatQuantity } from '../lib/quantity';
import { formatLotDate } from '../lib/stockLots';
import { useToast } from '../contexts/ToastContext';
import { ClipboardList, FileDown, Loader2, X } from 'lucide-react';

const loadPdf = () => import('../lib/pdf');

/**
 * Estacionamento item 22 (2/11/2026): lista de separação. Com `onToggle`, cada linha tem a caixa para marcar; sem ele
 * (cadastro do produto/cesta), é só a lista.
 */
export function PickListView({
  list,
  checked = [],
  onToggle,
}: {
  list: PickList;
  checked?: string[];
  onToggle?: (key: string) => void;
}) {
  const done = new Set(checked);
  if (list.lines.length === 0 && list.warnings.length === 0)
    return <p className="text-xs text-neutral-400 italic">Sem itens para separar.</p>;
  return (
    <div className="space-y-2">
      <ul className="divide-y divide-neutral-100" aria-label="Lista de separação">
        {list.lines.map(l => (
          <li key={l.key} className={cn('py-2 flex items-start gap-3', done.has(l.key) && 'opacity-50')}>
            {onToggle && (
              <input
                type="checkbox"
                aria-label={`Separado: ${l.name}`}
                checked={done.has(l.key)}
                onChange={() => onToggle(l.key)}
                className="mt-1 w-5 h-5 shrink-0 rounded border-neutral-300"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className={cn('text-sm font-bold text-neutral-900', done.has(l.key) && 'line-through')}>
                {l.name} · {formatQuantity(l.quantity)} {l.unit}
              </p>
              {l.kind === 'material' ? (
                <p className="text-xs text-neutral-600">
                  Pegar:{' '}
                  {l.lots.length
                    ? l.lots
                        .map(x => `${formatQuantity(x.quantity)} ${l.unit} (${formatLotDate(x.expiresAt)})`)
                        .join(' + ')
                    : '—'}
                  {l.short > 0 && (
                    <span className="ml-1 font-bold text-red-600">
                      · falta {formatQuantity(l.short)} {l.unit}
                    </span>
                  )}
                </p>
              ) : (
                <p className="text-xs text-neutral-600">Produto pronto (sem matéria-prima cadastrada)</p>
              )}
              <p className="text-[11px] text-neutral-400">{l.from.join(' · ')}</p>
            </div>
          </li>
        ))}
      </ul>
      {list.warnings.length > 0 && (
        <ul className="text-xs font-bold text-amber-700 space-y-1" role="status">
          {list.warnings.map(w => (
            <li key={w}>⚠ {w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Lista de separação do pedido (Histórico). As caixas marcadas ficam gravadas no orçamento (opção B). */
export function PickListModal({ quote, store, onClose }: { quote: Quote; store: Store | null; onClose: () => void }) {
  const { addToast } = useToast();
  const [data, setData] = useState<{
    products: Product[];
    materials: Material[];
    reservation?: StockReservation['reservations'];
  } | null>(null);
  const [checked, setChecked] = useState<string[]>(quote.pickedItems || []);

  // Outra aba/aparelho marcou: segue o que está gravado.
  useEffect(() => setChecked(quote.pickedItems || []), [quote.pickedItems]);

  useEffect(() => {
    let alive = true;
    const byStore = (name: string) => query(collection(db, name), where('storeId', '==', quote.storeId));
    Promise.all([
      getDocs(byStore('products')),
      getDocs(byStore('materials')),
      getDocs(
        query(
          collection(db, 'stockReservations'),
          where('storeId', '==', quote.storeId),
          where('quoteId', '==', quote.id),
        ),
      ).catch(() => null),
    ])
      .then(([p, m, r]) => {
        if (!alive) return;
        const active = r?.docs.map(d => d.data() as StockReservation).find(x => x.status === 'active');
        setData({
          products: p.docs.map(d => ({ id: d.id, ...d.data() }) as Product),
          materials: m.docs.map(d => ({ id: d.id, ...d.data() }) as Material),
          reservation: active?.reservations,
        });
      })
      .catch(err => {
        handleFirestoreError(err, OperationType.LIST, 'products');
        onClose();
      });
    return () => {
      alive = false;
    };
  }, [quote.id, quote.storeId, onClose]);

  const list = useMemo(
    () =>
      data ? buildPickList(quote.items || [], data.products, data.materials, { reservation: data.reservation }) : null,
    [data, quote.items],
  );

  const toggle = async (key: string) => {
    const next = checked.includes(key) ? checked.filter(k => k !== key) : [...checked, key];
    setChecked(next);
    try {
      await updateDoc(doc(db, 'quotes', quote.id), { pickedItems: next });
    } catch (err) {
      setChecked(checked);
      handleFirestoreError(err, OperationType.UPDATE, `quotes/${quote.id}`);
    }
  };

  const pdf = async () => {
    if (!list) return;
    try {
      await (
        await loadPdf()
      ).generatePickListPDF(
        `Separação — ${quote.clientName}`,
        `Orçamento de ${new Date(quote.date).toLocaleDateString('pt-BR')} · ${quote.items.length} item(ns)`,
        list,
        checked,
        store,
      );
    } catch {
      addToast('Erro ao gerar o PDF da separação', 'error');
    }
  };

  const total = list?.lines.length ?? 0;
  const marked = list ? list.lines.filter(l => checked.includes(l.key)).length : 0;
  return (
    <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 z-[60]">
      <div
        role="dialog"
        aria-label="Lista de separação"
        className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
              <ClipboardList className="w-5 h-5" /> Lista de separação
            </h3>
            <p className="text-xs text-neutral-500">
              {quote.clientName} · {marked} de {total} separados
            </p>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="p-2 hover:bg-neutral-100 rounded-full">
            <X className="w-5 h-5 text-neutral-400" />
          </button>
        </div>
        {!list ? (
          <div className="py-10 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
          </div>
        ) : (
          <PickListView list={list} checked={checked} onToggle={toggle} />
        )}
        <div className="flex gap-3 pt-2">
          <button
            onClick={pdf}
            disabled={!list}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-neutral-900 text-white rounded-xl font-bold text-sm disabled:opacity-40"
          >
            <FileDown className="w-4 h-4" /> Imprimir / PDF
          </button>
          <button onClick={onClose} className="px-4 py-3 bg-neutral-100 rounded-xl font-bold text-sm">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
