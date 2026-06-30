import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Quote, Material, StockReservation } from '../types';
import { formatCurrency } from '../lib/utils';
import { useStore } from '../contexts/StoreContext';
import { BarChart3, Package, Clock, CheckCircle2, XCircle, AlertCircle, TrendingUp } from 'lucide-react';

export function ProductionPanel() {
  const { activeStore } = useStore();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [reservations, setReservations] = useState<StockReservation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeStore) { setLoading(false); return; }

    const unsubQ = onSnapshot(
      query(collection(db, 'quotes'), where('storeId', '==', activeStore.id), orderBy('date', 'desc')),
      snap => { setQuotes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Quote))); setLoading(false); },
      err => { handleFirestoreError(err, OperationType.LIST, 'quotes'); setLoading(false); }
    );

    const unsubM = onSnapshot(
      query(collection(db, 'materials'), where('storeId', '==', activeStore.id)),
      snap => setMaterials(snap.docs.map(d => ({ id: d.id, ...d.data() } as Material))),
      () => {}
    );

    const unsubR = onSnapshot(
      query(collection(db, 'stockReservations'), where('storeId', '==', activeStore.id)),
      snap => setReservations(snap.docs.map(d => ({ id: d.id, ...d.data() } as StockReservation))),
      () => {}
    );

    return () => { unsubQ(); unsubM(); unsubR(); };
  }, [activeStore]);

  const byStatus = (status: string) => quotes.filter(q => q.status === status);
  const activeReservations = reservations.filter(r => r.status === 'active');

  // Materiais reservados agregados
  const reservedByMaterial: Record<string, { name: string; qty: number; unit: string }> = {};
  activeReservations.forEach(r => {
    r.reservations?.forEach(res => {
      if (!reservedByMaterial[res.materialId]) {
        const mat = materials.find(m => m.id === res.materialId);
        reservedByMaterial[res.materialId] = { name: res.materialName, qty: 0, unit: mat?.unit || '' };
      }
      reservedByMaterial[res.materialId].qty += res.quantity;
    });
  });

  // Top produtos vendidos
  const productCount: Record<string, number> = {};
  quotes.filter(q => ['Aprovado','Em produção','Finalizado'].includes(q.status || '')).forEach(q => {
    (q.items || []).forEach(item => {
      productCount[item.productName] = (productCount[item.productName] || 0) + (item.quantity || 1);
    });
  });
  const topProducts = Object.entries(productCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

  if (!activeStore) return <div className="p-10 text-center text-neutral-400">Selecione uma loja.</div>;
  if (loading) return <div className="animate-pulse h-96 bg-neutral-200 rounded-2xl" />;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-neutral-900">Painel de Produção</h1>
        <p className="text-neutral-500 mt-1">Visão completa do status de pedidos e estoque.</p>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Aguardando Produção', value: byStatus('Aprovado').length, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Em Produção', value: byStatus('Em produção').length, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Finalizados', value: byStatus('Finalizado').length, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Cancelados', value: byStatus('Cancelado').length, color: 'text-red-600', bg: 'bg-red-50' },
        ].map(stat => (
          <div key={stat.label} className={`${stat.bg} p-5 rounded-2xl border border-neutral-200`}>
            <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider">{stat.label}</p>
            <p className={`text-3xl font-black mt-1 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Materiais reservados */}
        <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
          <h2 className="text-base font-bold text-neutral-900 mb-4 flex items-center gap-2">
            <Package className="w-4 h-4 text-amber-500" /> Materiais Reservados
          </h2>
          {Object.keys(reservedByMaterial).length === 0 ? (
            <p className="text-neutral-400 italic text-sm py-8 text-center">Nenhuma reserva ativa.</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(reservedByMaterial).map(([id, data]) => {
                const mat = materials.find(m => m.id === id);
                const stock = mat?.stockQuantity || 0;
                const available = Math.max(0, stock - data.qty);
                return (
                  <div key={id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                    <div>
                      <p className="font-bold text-sm text-neutral-900">{data.name}</p>
                      <p className="text-xs text-neutral-400">Estoque: {stock} {data.unit} · Disponível: {available} {data.unit}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-amber-600">{data.qty} {data.unit}</p>
                      <p className="text-[10px] text-neutral-400">reservado</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top produtos */}
        <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
          <h2 className="text-base font-bold text-neutral-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" /> Produtos Mais Vendidos
          </h2>
          {topProducts.length === 0 ? (
            <p className="text-neutral-400 italic text-sm py-8 text-center">Nenhum pedido aprovado ainda.</p>
          ) : (
            <div className="space-y-3">
              {topProducts.map(([name, count], i) => (
                <div key={name} className="flex items-center gap-3">
                  <span className="text-xs font-black text-neutral-300 w-5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-neutral-900 truncate">{name}</p>
                    <div className="w-full bg-neutral-100 rounded-full h-1.5 mt-1">
                      <div className="bg-neutral-900 h-1.5 rounded-full" style={{ width: `${(count / (topProducts[0]?.[1] || 1)) * 100}%` }} />
                    </div>
                  </div>
                  <span className="text-sm font-black text-neutral-700 w-6 text-right">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pedidos em aberto */}
      <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
        <h2 className="text-base font-bold text-neutral-900 mb-5 flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-500" /> Pedidos Ativos
        </h2>
        <div className="space-y-3">
          {quotes.filter(q => ['Aprovado', 'Em produção'].includes(q.status || '')).length === 0 ? (
            <p className="text-neutral-400 italic text-sm text-center py-8">Nenhum pedido ativo no momento.</p>
          ) : (
            quotes.filter(q => ['Aprovado', 'Em produção'].includes(q.status || '')).map(q => (
              <div key={q.id} className="flex items-center justify-between p-4 rounded-xl border border-neutral-100 hover:bg-neutral-50 transition-colors">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-neutral-900">{q.clientName}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${q.status === 'Em produção' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                      {q.status}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {(q.items || []).map(i => i.productName).join(', ')} · {new Date(q.date).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <p className="font-black text-neutral-900">{formatCurrency(q.totalAmount)}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
