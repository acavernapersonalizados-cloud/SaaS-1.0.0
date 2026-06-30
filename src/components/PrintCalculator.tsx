import React, { useState, useEffect } from 'react';
import {
  collection, addDoc, deleteDoc, doc, onSnapshot,
  query, orderBy, where, setDoc, getDoc, writeBatch
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { PrintJob, PrinterProfile } from '../types';
import { formatCurrency } from '../lib/utils';
import { useStore } from '../contexts/StoreContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  Box, Plus, Trash2, X, Loader2, Sparkles, DollarSign,
  AlertCircle, CheckCircle2, Settings, ChevronDown, ChevronUp,
  Info, Edit2, Save, Layers, Calculator, Clock
} from 'lucide-react';

const ELECTRICITY_RATE_DEFAULT = 0.85;

const FILAMENTS = [
  'PLA', 'PLA+', 'PETG', 'ABS', 'ASA', 'TPU', 'Nylon',
  'Resina Standard', 'Resina ABS-Like', 'Resina Flex', 'Fibra de Carbono', 'Wood Fill', 'Personalizado'
];

const DEFAULT_PRINTERS: Omit<PrinterProfile, 'id' | 'storeId' | 'createdAt'>[] = [
  {
    label: 'Creality K1C (Hi Combo)',
    brand: 'Creality',
    model: 'K1C',
    powerConsumptionW: 350,
    buildVolumeX: 220, buildVolumeY: 220, buildVolumeZ: 250,
    maxSpeedMmS: 600,
    hotendReplacementCost: 80,
    hotendLifeH: 500,
    bedReplacementCost: 60,
    bedLifeH: 2000,
    maintenanceCostPerH: 0.15,
    isDefault: true,
  },
];

export function PrintCalculator() {
  const { activeStore } = useStore();
  const { user, isAdmin } = useAuth();
  const { addToast } = useToast();

  const [printers, setPrinters] = useState<PrinterProfile[]>([]);
  const [printersLoading, setPrintersLoading] = useState(true);
  const [showPrinterForm, setShowPrinterForm] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<PrinterProfile | null>(null);
  const emptyPrinter: Partial<PrinterProfile> = {
    label: '', brand: '', model: '', powerConsumptionW: 200,
    buildVolumeX: 220, buildVolumeY: 220, buildVolumeZ: 250,
    maxSpeedMmS: 100, hotendReplacementCost: 80, hotendLifeH: 500,
    bedReplacementCost: 60, bedLifeH: 2000, maintenanceCostPerH: 0.10,
  };
  const [newPrinter, setNewPrinter] = useState<Partial<PrinterProfile>>(emptyPrinter);
  const [savingPrinter, setSavingPrinter] = useState(false);

  const [selectedPrinterId, setSelectedPrinterId] = useState('');
  const [jobName, setJobName] = useState('');
  const [filamentType, setFilamentType] = useState('PLA');
  const [filamentCostPerKg, setFilamentCostPerKg] = useState(80);
  const [filamentUsedG, setFilamentUsedG] = useState(50);
  const [printTimeH, setPrintTimeH] = useState(2);
  const [failureRatePct, setFailureRatePct] = useState(5);
  const [quantity, setQuantity] = useState(1);
  const [hourlyRate, setHourlyRate] = useState(12);
  const [profitMarginPct, setProfitMarginPct] = useState(60);
  const [electricityRate, setElectricityRate] = useState(ELECTRICITY_RATE_DEFAULT);
  const [manualPrice, setManualPrice] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState('');

  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [savingJob, setSavingJob] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const seedDefaultPrinters = async (storeId: string) => {
    for (const p of DEFAULT_PRINTERS) {
      const id = `default_${storeId}_${p.model.replace(/\s+/g, '_').toLowerCase()}`;
      const ref = doc(db, 'printers', id);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, { ...p, id, storeId, createdAt: new Date().toISOString() });
      }
    }
  };

  useEffect(() => {
    if (!activeStore) { setPrintersLoading(false); setLoadingJobs(false); return; }

    seedDefaultPrinters(activeStore.id).catch(console.warn);

    const unsubP = onSnapshot(
      query(collection(db, 'printers'), where('storeId', '==', activeStore.id), orderBy('label', 'asc')),
      snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as PrinterProfile));
        setPrinters(list);
        if (!selectedPrinterId && list.length > 0) setSelectedPrinterId(list[0].id);
        setPrintersLoading(false);
      },
      err => { handleFirestoreError(err, OperationType.LIST, 'printers'); setPrintersLoading(false); }
    );

    const unsubJ = onSnapshot(
      query(collection(db, 'printJobs'), where('storeId', '==', activeStore.id), orderBy('createdAt', 'desc')),
      snap => { setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() } as PrintJob))); setLoadingJobs(false); },
      err => { handleFirestoreError(err, OperationType.LIST, 'printJobs'); setLoadingJobs(false); }
    );

    return () => { unsubP(); unsubJ(); };
  }, [activeStore]);

  const selectedPrinter = printers.find(p => p.id === selectedPrinterId) ?? null;

  const calc = () => {
    if (!selectedPrinter || printTimeH <= 0) return null;
    const failFactor = 1 + (failureRatePct / 100);
    const energyCost = (selectedPrinter.powerConsumptionW / 1000) * printTimeH * electricityRate * failFactor;
    const hotendWear = (selectedPrinter.hotendReplacementCost / selectedPrinter.hotendLifeH) * printTimeH * failFactor;
    const bedWear = (selectedPrinter.bedReplacementCost / selectedPrinter.bedLifeH) * printTimeH * failFactor;
    const maintenance = selectedPrinter.maintenanceCostPerH * printTimeH * failFactor;
    const filamentCost = (filamentUsedG / 1000) * filamentCostPerKg * failFactor;
    const laborCost = hourlyRate * printTimeH * failFactor;
    const totalCostUnit = energyCost + hotendWear + bedWear + maintenance + filamentCost + laborCost;
    const totalCostBatch = totalCostUnit * quantity;
    const suggestedUnit = totalCostUnit * (1 + profitMarginPct / 100);
    const suggestedBatch = totalCostBatch * (1 + profitMarginPct / 100);
    const priceRef = manualPrice ?? suggestedUnit;
    const profit = priceRef - totalCostUnit;
    const margin = priceRef > 0 ? (profit / priceRef) * 100 : 0;
    return { energyCost, hotendWear, bedWear, maintenance, filamentCost, laborCost, totalCostUnit, totalCostBatch, suggestedUnit, suggestedBatch, profit, margin };
  };
  const result = calc();

  const handleSavePrinter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStore || !newPrinter.label) return;
    setSavingPrinter(true);
    try {
      const data = { ...newPrinter, storeId: activeStore.id };
      if (editingPrinter) {
        await setDoc(doc(db, 'printers', editingPrinter.id), { ...data, id: editingPrinter.id, createdAt: editingPrinter.createdAt, updatedAt: new Date().toISOString() });
        addToast('Impressora atualizada!', 'success');
      } else {
        const ref = await addDoc(collection(db, 'printers'), data);
        await setDoc(ref, { ...data, id: ref.id, createdAt: new Date().toISOString() });
        addToast('Impressora cadastrada!', 'success');
      }
      setShowPrinterForm(false); setEditingPrinter(null); setNewPrinter(emptyPrinter);
    } catch (err) { handleFirestoreError(err, OperationType.CREATE, 'printers'); }
    setSavingPrinter(false);
  };

  const handleDeletePrinter = async (id: string) => {
    if (!window.confirm('Excluir esta impressora?')) return;
    try { await deleteDoc(doc(db, 'printers', id)); addToast('Impressora excluída.', 'success'); }
    catch (err) { handleFirestoreError(err, OperationType.DELETE, `printers/${id}`); }
  };

  const handleSaveJob = async () => {
    if (!activeStore || !jobName || !selectedPrinter || printTimeH <= 0) {
      addToast('Preencha nome e tempo de impressão.', 'error'); return;
    }
    setSavingJob(true);
    try {
      await addDoc(collection(db, 'printJobs'), {
        storeId: activeStore.id, name: jobName,
        printerId: selectedPrinter.id, printerName: selectedPrinter.label,
        filamentType, filamentCostPerKg, filamentUsedG, printTimeH,
        failureRatePct, quantity, manualPrice: manualPrice ?? null, notes,
        createdAt: new Date().toISOString(),
      });
      addToast('Trabalho salvo!', 'success');
      setJobName(''); setAiAnalysis(''); setManualPrice(null); setNotes('');
    } catch (err) { handleFirestoreError(err, OperationType.CREATE, 'printJobs'); }
    setSavingJob(false);
  };

  const handleDeleteJob = async (id: string) => {
    setDeletingId(id);
    try { await deleteDoc(doc(db, 'printJobs', id)); addToast('Trabalho excluído.', 'success'); }
    catch (err) { handleFirestoreError(err, OperationType.DELETE, `printJobs/${id}`); }
    setDeletingId(null);
  };

  if (!activeStore) return (
    <div className="flex flex-col items-center justify-center h-96 space-y-4">
      <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center"><Box className="w-8 h-8 text-neutral-400"/></div>
      <h2 className="text-xl font-bold">Selecione uma loja</h2>
    </div>
  );

  return (
    <div className="space-y-8 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-neutral-400 mb-1"><Box className="w-4 h-4"/><span className="text-xs font-bold uppercase tracking-widest">Calculadora</span></div>
          <h1 className="text-3xl font-black text-neutral-900">Impressão 3D</h1>
        </div>
        <button onClick={() => setShowPrinterForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-neutral-100 text-neutral-900 rounded-xl hover:bg-neutral-200 transition-all text-sm font-bold">
          <Plus className="w-4 h-4"/> Nova Impressora
        </button>
      </header>

      {/* Printer selection */}
      <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm space-y-3">
        <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-2"><Settings className="w-3.5 h-3.5"/> Impressora</h2>
        {printersLoading ? <div className="animate-pulse h-24 bg-neutral-100 rounded-xl"/> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {printers.map(p => (
              <div key={p.id} className={`relative p-4 rounded-2xl border-2 cursor-pointer transition-all ${selectedPrinterId === p.id ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-100 hover:border-neutral-300'}`}
                onClick={() => setSelectedPrinterId(p.id)}>
                <div className="flex items-start justify-between mb-1">
                  <p className="font-bold text-sm text-neutral-900 leading-tight">{p.label}</p>
                  {selectedPrinterId === p.id && <CheckCircle2 className="w-4 h-4 text-neutral-900 flex-shrink-0"/>}
                </div>
                <p className="text-xs text-neutral-400">{p.brand} {p.model} · {p.powerConsumptionW}W</p>
                <p className="text-xs text-neutral-400">{p.buildVolumeX}×{p.buildVolumeY}×{p.buildVolumeZ}mm</p>
                {!p.isDefault && (isAdmin || user?.role === 'GERENTE') && (
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                    <button onClick={() => { setEditingPrinter(p); setNewPrinter(p); setShowPrinterForm(true); }} className="p-1 hover:bg-neutral-200 rounded-lg"><Edit2 className="w-3 h-3"/></button>
                    <button onClick={() => handleDeletePrinter(p.id)} className="p-1 hover:bg-red-100 rounded-lg text-red-500"><Trash2 className="w-3 h-3"/></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm space-y-4">
            <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-2"><Layers className="w-3.5 h-3.5"/> Parâmetros de Impressão</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-bold text-neutral-600">Nome do Trabalho</label>
                <input type="text" value={jobName} onChange={e => setJobName(e.target.value)}
                  placeholder="Ex: Vaso de planta PLA branco"
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm"/>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600">Filamento</label>
                <select value={filamentType} onChange={e => setFilamentType(e.target.value)}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm">
                  {FILAMENTS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600">Quantidade de peças</label>
                <input type="number" min="1" value={quantity} onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm"/>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600">Custo do Filamento (R$/kg)</label>
                <input type="number" min="0" step="0.5" value={filamentCostPerKg} onChange={e => setFilamentCostPerKg(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm"/>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600">Filamento Usado (g)</label>
                <input type="number" min="0" step="1" value={filamentUsedG} onChange={e => setFilamentUsedG(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm"/>
                <p className="text-[10px] text-neutral-400">Valor do slicer (Cura, PrusaSlicer, etc.)</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600">Tempo de Impressão (horas)</label>
                <input type="number" min="0" step="0.5" value={printTimeH} onChange={e => setPrintTimeH(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm"/>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600">Taxa de Falha / Buffer (%)</label>
                <input type="number" min="0" max="50" step="1" value={failureRatePct} onChange={e => setFailureRatePct(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm"/>
                <p className="text-[10px] text-neutral-400">Ex: 5% = 5% extra de material e tempo para cobrir falhas.</p>
              </div>
            </div>

            {printTimeH > 0 && (
              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-neutral-500"/>
                <span className="text-sm font-bold text-neutral-700">{printTimeH}h impressão · {filamentUsedG}g de {filamentType}</span>
              </div>
            )}

            <div className="border-t border-neutral-100 pt-3">
              <button type="button" onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-xs font-bold text-neutral-400 hover:text-neutral-900 transition-colors">
                {showAdvanced ? <ChevronUp className="w-3.5 h-3.5"/> : <ChevronDown className="w-3.5 h-3.5"/>}
                Configurações Avançadas
              </button>
              {showAdvanced && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                  {[
                    { label: 'Tarifa Energia (R$/kWh)', val: electricityRate, set: setElectricityRate },
                    { label: 'Valor Hora Operador (R$)', val: hourlyRate, set: setHourlyRate },
                    { label: 'Margem de Lucro (%)', val: profitMarginPct, set: setProfitMarginPct },
                  ].map(f => (
                    <div key={f.label} className="space-y-1">
                      <label className="text-xs font-bold text-neutral-600">{f.label}</label>
                      <input type="number" step="0.01" value={f.val} onChange={e => f.set(Number(e.target.value))}
                        className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm"/>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm resize-none" placeholder="Observações…"/>
          </div>

          {result && (
            <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm space-y-4">
              <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-2"><DollarSign className="w-3.5 h-3.5"/> Preço de Venda</h2>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-bold text-sm">R$</span>
                <input type="number" step="0.01" min="0" value={manualPrice ?? ''}
                  onChange={e => setManualPrice(e.target.value ? Number(e.target.value) : null)}
                  className="w-full pl-12 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none font-bold text-lg"
                  placeholder={formatCurrency(result.suggestedUnit)}/>
              </div>
              <button type="button" onClick={handleSaveJob} disabled={savingJob || !jobName || printTimeH <= 0}
                className="w-full flex items-center justify-center gap-2 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all disabled:opacity-40">
                {savingJob ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
                Salvar Trabalho
              </button>
            </div>
          )}
        </div>

        {/* Result panel */}
        <div>
          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm space-y-4 sticky top-4">
            <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-2"><Calculator className="w-3.5 h-3.5"/> Resultado</h2>
            {!result ? (
              <div className="py-12 text-center text-neutral-400 text-sm italic">Preencha os parâmetros para calcular.</div>
            ) : (
              <div className="space-y-3">
                <div className="p-4 bg-neutral-50 rounded-xl space-y-2">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Composição / peça</p>
                  {[
                    { label: '⚡ Energia', val: result.energyCost },
                    { label: '🧵 Filamento', val: result.filamentCost },
                    { label: '🔩 Desgaste hotend', val: result.hotendWear },
                    { label: '🛏 Desgaste mesa', val: result.bedWear },
                    { label: '🔧 Manutenção', val: result.maintenance },
                    { label: '👤 Mão de obra', val: result.laborCost },
                  ].map(r => (
                    <div key={r.label} className="flex justify-between text-sm">
                      <span className="text-neutral-600">{r.label}</span>
                      <span className="font-bold">{formatCurrency(r.val)}</span>
                    </div>
                  ))}
                  <div className="border-t border-neutral-200 pt-1.5 flex justify-between font-black text-sm">
                    <span>Custo / peça</span><span>{formatCurrency(result.totalCostUnit)}</span>
                  </div>
                </div>

                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                  <p className="text-[10px] font-bold text-emerald-600 uppercase">Sugerido ({profitMarginPct}%)</p>
                  <p className="text-2xl font-black text-emerald-700">{formatCurrency(result.suggestedUnit)}<span className="text-sm font-medium">/peça</span></p>
                  {quantity > 1 && <p className="text-sm text-emerald-600 font-bold mt-0.5">{formatCurrency(result.suggestedBatch)} total ({quantity} peças)</p>}
                </div>

                {manualPrice != null && manualPrice > 0 && (
                  <div className={`p-4 rounded-xl border space-y-2 ${result.profit >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-red-50 border-red-100'}`}>
                    <div className="flex items-center justify-between">
                      <p className={`text-2xl font-black ${result.profit >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{formatCurrency(manualPrice)}</p>
                      {result.profit >= 0 ? <CheckCircle2 className="w-5 h-5 text-emerald-500"/> : <AlertCircle className="w-5 h-5 text-red-500"/>}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><p className="text-[10px] text-neutral-400 uppercase font-bold">Lucro</p><p className={`font-black text-sm ${result.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(result.profit)}</p></div>
                      <div><p className="text-[10px] text-neutral-400 uppercase font-bold">Margem</p><p className={`font-black text-sm ${result.margin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{result.margin.toFixed(1)}%</p></div>
                    </div>
                    {result.profit < 0 && (
                      <div className="flex items-start gap-2 p-2 bg-red-100 rounded-lg">
                        <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0"/>
                        <p className="text-xs text-red-700 font-medium">Prejuízo de {formatCurrency(Math.abs(result.profit))}/peça. Mínimo: {formatCurrency(result.totalCostUnit)}.</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="p-3 bg-neutral-50 rounded-xl text-xs text-neutral-400">
                  {selectedPrinter?.label} · {failureRatePct}% buffer de falha incluído
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* History */}
      <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-neutral-900">Trabalhos Salvos</h2>
        {loadingJobs ? <div className="animate-pulse h-24 bg-neutral-100 rounded-xl"/> : jobs.length === 0 ? (
          <p className="py-10 text-center text-neutral-400 italic text-sm">Nenhum trabalho salvo.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-neutral-100">
                {['Trabalho', 'Impressora', 'Filamento', 'Qtd', 'Preço', ''].map(h => (
                  <th key={h} className="text-left py-2 pr-4 text-[10px] font-black text-neutral-400 uppercase">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {jobs.map(job => (
                  <tr key={job.id} className="border-b border-neutral-50 hover:bg-neutral-50 transition-colors">
                    <td className="py-3 pr-4 font-bold text-neutral-900">{job.name}</td>
                    <td className="py-3 pr-4 text-neutral-500 text-xs">{job.printerName || job.printerId}</td>
                    <td className="py-3 pr-4 text-neutral-500">{job.filamentType}</td>
                    <td className="py-3 pr-4 text-right">{job.quantity}</td>
                    <td className="py-3 pr-4 font-bold text-right">{job.manualPrice ? formatCurrency(job.manualPrice) : '—'}</td>
                    <td className="py-3 text-right">
                      {(isAdmin || user?.role === 'GERENTE') && (
                        <button onClick={() => handleDeleteJob(job.id)} disabled={deletingId === job.id}
                          className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                          {deletingId === job.id ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Trash2 className="w-3.5 h-3.5"/>}
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

      <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 flex gap-4">
        <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0"><Info className="w-4 h-4 text-blue-600"/></div>
        <div>
          <p className="font-bold text-blue-900 text-sm mb-1">Sobre os cálculos</p>
          <p className="text-blue-700 text-xs leading-relaxed">Os dados de filamento usado e tempo de impressão devem vir do slicer (Cura, PrusaSlicer, Bambu Studio). A taxa de falha adiciona um buffer automático sobre todos os custos. Cadastre novas impressoras para calcular por máquina.</p>
        </div>
      </div>

      {/* Printer form modal */}
      {showPrinterForm && (
        <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-8 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold">{editingPrinter ? 'Editar Impressora' : 'Nova Impressora'}</h3>
              <button onClick={() => { setShowPrinterForm(false); setEditingPrinter(null); }} className="p-2 hover:bg-neutral-100 rounded-full"><X className="w-5 h-5 text-neutral-400"/></button>
            </div>
            <form onSubmit={handleSavePrinter} className="space-y-4">
              {[
                { label: 'Nome', key: 'label', type: 'text' },
                { label: 'Marca', key: 'brand', type: 'text' },
                { label: 'Modelo', key: 'model', type: 'text' },
                { label: 'Consumo Elétrico (W)', key: 'powerConsumptionW', type: 'number' },
                { label: 'Volume X (mm)', key: 'buildVolumeX', type: 'number' },
                { label: 'Volume Y (mm)', key: 'buildVolumeY', type: 'number' },
                { label: 'Volume Z (mm)', key: 'buildVolumeZ', type: 'number' },
                { label: 'Velocidade Máx (mm/s)', key: 'maxSpeedMmS', type: 'number' },
                { label: 'Custo Reposição Hotend (R$)', key: 'hotendReplacementCost', type: 'number' },
                { label: 'Vida Útil Hotend (horas)', key: 'hotendLifeH', type: 'number' },
                { label: 'Custo Reposição Mesa (R$)', key: 'bedReplacementCost', type: 'number' },
                { label: 'Vida Útil Mesa (horas)', key: 'bedLifeH', type: 'number' },
                { label: 'Manutenção Geral (R$/h)', key: 'maintenanceCostPerH', type: 'number' },
              ].map(f => (
                <div key={f.key} className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700">{f.label}</label>
                  <input type={f.type} required value={(newPrinter as any)[f.key] ?? ''}
                    onChange={e => setNewPrinter(p => ({ ...p, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value }))}
                    className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm"/>
                </div>
              ))}
              <button type="submit" disabled={savingPrinter}
                className="w-full py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {savingPrinter ? <><Loader2 className="w-4 h-4 animate-spin"/>Salvando...</> : <><Save className="w-4 h-4"/>{editingPrinter ? 'Atualizar' : 'Cadastrar'}</>}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
