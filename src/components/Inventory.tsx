import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, doc, runTransaction } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Material } from '../types';
import { cn, isLowStock } from '../lib/utils';
import {
  addToLots,
  changeLotExpiry,
  consumptionOrder,
  formatLotDate,
  isExpired,
  materialLots,
  stockFields,
  takeFromLots,
  todayISO,
} from '../lib/stockLots';
import { useStore } from '../contexts/StoreContext';
import { useToast } from '../contexts/ToastContext';
import { Plus, Minus, AlertCircle, Package } from 'lucide-react';
import { SearchBar } from './SearchBar';

/** Recusa do "Alterar validade" dentro da transação (vira mensagem na tela, não erro do banco). */
class LotError extends Error {}

/** Formulário dentro da tabela: no celular, preso à esquerda e da largura da tela. */
const FORM_FIT = 'sticky left-2 max-w-[calc(100vw-5rem)] md:static md:max-w-none';

export function Inventory() {
  const { activeStore } = useStore();
  const { addToast } = useToast();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!activeStore) {
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'materials'), where('storeId', '==', activeStore.id));
    const unsubscribe = onSnapshot(
      q,
      snapshot => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Material);
        setMaterials(data);
        setLoading(false);
      },
      error => {
        handleFirestoreError(error, OperationType.LIST, 'materials');
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, [activeStore]);

  // Estacionamento item 21: entrada com validade (vira um lote; mesma validade junta no mesmo lote).
  const [entryFor, setEntryFor] = useState<string | null>(null);
  const [entryQty, setEntryQty] = useState<number | ''>('');
  const [entryDate, setEntryDate] = useState('');

  /** `delta` > 0 entra no lote da validade dada; < 0 sai do lote não vencido que vence antes. */
  const updateStock = async (id: string, delta: number, expiresAt: string | null = null) => {
    const material = materials.find(m => m.id === id);
    if (!material) return false;

    try {
      // Transação: evita perda de atualização quando dois usuários mexem ao
      // mesmo tempo e impede estoque negativo.
      await runTransaction(db, async tx => {
        const ref = doc(db, 'materials', id);
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('Material não encontrado');
        const today = todayISO();
        const lots = materialLots(snap.data() as Material, today);
        let next = lots;
        if (delta > 0) next = addToLots(lots, delta, expiresAt);
        else {
          const r = takeFromLots(lots, -delta, today);
          if (r.missing > 0) throw new Error('Estoque não pode ficar negativo');
          next = r.lots;
        }
        tx.update(ref, { ...stockFields(next), updatedAt: new Date().toISOString() });
      });
      addToast('Estoque atualizado com sucesso!', 'success');
      return true;
    } catch (error) {
      if (error instanceof Error && error.message === 'Estoque não pode ficar negativo') {
        addToast('Estoque não pode ficar negativo (lote vencido não sai pela baixa).', 'error');
        return false;
      }
      handleFirestoreError(error, OperationType.UPDATE, `materials/${id}`);
      return false;
    }
  };

  const saveEntry = async (id: string) => {
    const qty = Number(entryQty) || 0;
    if (qty <= 0) {
      addToast('Informe a quantidade da entrada.', 'error');
      return;
    }
    if (await updateStock(id, qty, entryDate || null)) {
      setEntryFor(null);
      setEntryQty('');
      setEntryDate('');
    }
  };

  // Item 21: "Alterar validade" de um lote (inteiro ou parte). O saldo não muda.
  const [editLot, setEditLot] = useState<{ materialId: string; lotId: string; qty: number | ''; date: string } | null>(
    null,
  );

  const saveLotExpiry = async () => {
    if (!editLot) return;
    const material = materials.find(m => m.id === editLot.materialId);
    if (!material) return;
    const check = changeLotExpiry(materialLots(material), editLot.lotId, Number(editLot.qty), editLot.date || null);
    if ('error' in check) {
      addToast(check.error, 'error');
      return;
    }
    try {
      await runTransaction(db, async tx => {
        const ref = doc(db, 'materials', material.id);
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('Material não encontrado');
        const r = changeLotExpiry(
          materialLots(snap.data() as Material),
          editLot.lotId,
          Number(editLot.qty),
          editLot.date || null,
        );
        if ('error' in r) throw new LotError(r.error);
        tx.update(ref, { ...stockFields(r.lots), updatedAt: new Date().toISOString() });
      });
      addToast('Validade alterada.', 'success');
      setEditLot(null);
    } catch (error) {
      if (error instanceof LotError) {
        addToast(error.message, 'error');
        return;
      }
      handleFirestoreError(error, OperationType.UPDATE, `materials/${material.id}`);
    }
  };

  const filteredMaterials = materials.filter(m => (m.name || '').toLowerCase().includes(searchTerm.toLowerCase()));

  const today = todayISO();
  const totalValue = materials.reduce((acc, m) => acc + (m.stockQuantity || 0) * m.unitCost, 0);
  const lowStockItems = materials.filter(isLowStock);

  if (!activeStore) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center">
          <Package className="w-8 h-8 text-neutral-400" />
        </div>
        <h2 className="text-xl font-bold text-neutral-900">Selecione uma loja</h2>
        <p className="text-neutral-500">Você precisa selecionar uma loja para gerenciar o estoque.</p>
      </div>
    );
  }

  if (loading) return <div className="animate-pulse h-96 bg-neutral-200 rounded-2xl" />;

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Estoque</h1>
        <p className="text-neutral-500 mt-1">Gerencie a entrada e saída de insumos.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
          <div className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Total de Insumos</div>
          <div className="text-3xl font-bold text-neutral-900 mt-2">{materials.length}</div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
          <div className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Valor Total em Estoque</div>
          <div className="text-3xl font-bold text-neutral-900 mt-2">R$ {totalValue.toFixed(2)}</div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
          <div className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Itens com Estoque Baixo</div>
          <div className="text-3xl font-bold text-red-600 mt-2">{lowStockItems.length}</div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm space-y-6">
        <SearchBar placeholder="Buscar material..." value={searchTerm} onChange={setSearchTerm} />

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-neutral-100">
                <th className="pb-4 pt-2 font-bold text-xs uppercase tracking-wider text-neutral-400">Material</th>
                <th className="pb-4 pt-2 font-bold text-xs uppercase tracking-wider text-neutral-400">Estoque Atual</th>
                <th className="pb-4 pt-2 font-bold text-xs uppercase tracking-wider text-neutral-400">
                  Estoque Mínimo
                </th>
                <th className="pb-4 pt-2 font-bold text-xs uppercase tracking-wider text-neutral-400 text-right">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {filteredMaterials.map(material => {
                const lots = consumptionOrder(materialLots(material, today), today, true);
                return (
                  <React.Fragment key={material.id}>
                    <tr className="group hover:bg-neutral-50 transition-colors">
                      <td className="py-4 font-bold text-neutral-900">{material.name}</td>
                      <td className="py-4 text-sm font-bold text-neutral-900">
                        {material.stockQuantity} {material.unit}
                        {isLowStock(material) && (
                          <span className="ml-2 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">
                            BAIXO
                          </span>
                        )}
                        {lots.length > 0 && (
                          <ul className="mt-1 space-y-0.5 text-[11px] font-medium text-neutral-500" aria-label="Lotes">
                            {lots.map(l => {
                              const expired = isExpired(l, today);
                              return (
                                <li key={l.id} className={cn('whitespace-nowrap', expired && 'text-red-600 font-bold')}>
                                  {l.quantity} {material.unit} ·{' '}
                                  {l.expiresAt ? `val. ${formatLotDate(l.expiresAt)}` : 'sem validade'}
                                  {expired && ' · vencido'}{' '}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditLot(
                                        editLot?.lotId === l.id && editLot.materialId === material.id
                                          ? null
                                          : {
                                              materialId: material.id,
                                              lotId: l.id,
                                              qty: l.quantity,
                                              date: l.expiresAt || '',
                                            },
                                      )
                                    }
                                    className="ml-1 underline text-neutral-700 font-bold"
                                  >
                                    alterar
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                        {/* Abaixo do saldo (e não nas ações) para aparecer no celular sem rolar a tabela. */}
                        <button
                          type="button"
                          onClick={() => {
                            setEntryFor(entryFor === material.id ? null : material.id);
                            setEntryQty('');
                            setEntryDate('');
                          }}
                          className="mt-2 block px-3 py-1.5 text-xs font-bold text-neutral-700 border border-neutral-200 hover:bg-neutral-100 rounded-lg transition-all"
                        >
                          Entrada
                        </button>
                      </td>
                      <td className="py-4 text-sm text-neutral-500">
                        {Number(material.minStockQuantity) > 0 ? `${material.minStockQuantity} ${material.unit}` : '—'}
                      </td>
                      <td className="py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => updateStock(material.id, -1)}
                            className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => updateStock(material.id, 1)}
                            className="p-2 text-neutral-400 hover:text-green-500 hover:bg-green-50 rounded-lg transition-all"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {editLot?.materialId === material.id && lots.some(l => l.id === editLot.lotId) && (
                      <tr className="bg-neutral-50">
                        <td colSpan={4} className="py-3 px-2">
                          {/* No celular a tabela rola para o lado; o formulário fica do tamanho da tela. */}
                          <div className={FORM_FIT}>
                            <p className="text-xs font-bold text-neutral-700 mb-2">
                              Alterar validade do lote de{' '}
                              {(() => {
                                const l = lots.find(x => x.id === editLot.lotId)!;
                                return `${l.quantity} ${material.unit} (${formatLotDate(l.expiresAt)})`;
                              })()}
                            </p>
                            <div className="flex flex-wrap items-end gap-3">
                              <label className="text-xs font-bold text-neutral-600 space-y-1">
                                <span className="block">Quantidade ({material.unit})</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={editLot.qty}
                                  onChange={e =>
                                    setEditLot({ ...editLot, qty: e.target.value === '' ? '' : Number(e.target.value) })
                                  }
                                  className="w-28 px-3 py-2 bg-white border border-neutral-200 rounded-lg"
                                />
                              </label>
                              <label className="text-xs font-bold text-neutral-600 space-y-1">
                                <span className="block">Nova validade</span>
                                <input
                                  type="date"
                                  value={editLot.date}
                                  onChange={e => setEditLot({ ...editLot, date: e.target.value })}
                                  className="px-3 py-2 bg-white border border-neutral-200 rounded-lg"
                                />
                              </label>
                              <button
                                type="button"
                                onClick={saveLotExpiry}
                                className="px-4 py-2 bg-neutral-900 text-white text-xs font-bold rounded-lg"
                              >
                                Salvar validade
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditLot(null)}
                                className="px-3 py-2 text-xs font-bold text-neutral-500"
                              >
                                Cancelar
                              </button>
                            </div>
                            {editLot.date && editLot.date < today && (
                              <p role="alert" className="mt-2 text-xs font-bold text-red-600">
                                Essa data já passou: o lote fica vencido e não sai na baixa nem na reserva.
                              </p>
                            )}
                            <p className="mt-2 text-[11px] text-neutral-400">Validade vazia = sem validade.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                    {entryFor === material.id && (
                      <tr className="bg-neutral-50">
                        <td colSpan={4} className="py-3 px-2">
                          <div className={cn(FORM_FIT, 'flex flex-wrap items-end gap-3')}>
                            <label className="text-xs font-bold text-neutral-600 space-y-1">
                              <span className="block">Quantidade ({material.unit})</span>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={entryQty}
                                onChange={e => setEntryQty(e.target.value === '' ? '' : Number(e.target.value))}
                                className="w-28 px-3 py-2 bg-white border border-neutral-200 rounded-lg"
                              />
                            </label>
                            <label className="text-xs font-bold text-neutral-600 space-y-1">
                              <span className="block">Validade (opcional)</span>
                              <input
                                type="date"
                                value={entryDate}
                                onChange={e => setEntryDate(e.target.value)}
                                className="px-3 py-2 bg-white border border-neutral-200 rounded-lg"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => saveEntry(material.id)}
                              className="px-4 py-2 bg-neutral-900 text-white text-xs font-bold rounded-lg"
                            >
                              Salvar entrada
                            </button>
                            <button
                              type="button"
                              onClick={() => setEntryFor(null)}
                              className="px-3 py-2 text-xs font-bold text-neutral-500"
                            >
                              Cancelar
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
