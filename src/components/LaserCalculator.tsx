import React, { useState, useEffect } from 'react';
import {
  collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy,
  where, setDoc, getDoc
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { LaserJob, LaserMachineProfile } from '../types';
import { formatCurrency } from '../lib/utils';
import { useStore } from '../contexts/StoreContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { analyzeLaserPrice } from '../services/gemini';
import {
  Zap, Calculator, Sparkles, Trash2, Plus, X, Loader2, Clock,
  DollarSign, TrendingUp, AlertCircle, CheckCircle2, Settings,
  Layers, ChevronDown, ChevronUp, Info, Edit2, Save
} from 'lucide-react';

const ELECTRICITY_RATE_DEFAULT = 0.85; // R$/kWh média Brasil

// ── Perfis padrão (seed) ─────────────────────────────────────────────────────
const DEFAULT_MACHINES: Omit<LaserMachineProfile, 'id' | 'storeId' | 'createdAt'>[] = [
  {
    label: 'Two Trees TS2 10W',
    laserType: 'Diodo 450nm',
    powerW: 10,
    powerConsumptionW: 60,
    workAreaW: 430, workAreaH: 400,
    maxSpeedMmMin: 24000,
    diodeLifeH: 10000,
    moduleReplacementCost: 280,
    isDefault: true,
    materials: [
      'MDF 3mm', 'MDF 6mm', 'Compensado 3mm', 'Compensado 6mm',
      'Acrílico (com película)', 'Couro', 'Couro sintético',
      'EVA', 'Papel', 'Papelão', 'Tecido', 'Feltro',
      'Borracha', 'Bambu', 'Madeira balsa', 'Cortiça', 'Personalizado'
    ],
  },
  {
    label: 'Creality Falcon 2 Pro 22W (Hi Combo)',
    laserType: 'Diodo 455nm',
    powerW: 22,
    powerConsumptionW: 120,
    workAreaW: 400, workAreaH: 415,
    maxSpeedMmMin: 25000,
    diodeLifeH: 10000,
    moduleReplacementCost: 580,
    isDefault: true,
    materials: [
      'MDF 3mm', 'MDF 6mm', 'MDF 9mm', 'Compensado 3mm', 'Compensado 6mm',
      'Acrílico (com película)', 'Couro', 'Couro sintético',
      'EVA', 'Papel', 'Papelão', 'Tecido', 'Feltro', 'Borracha',
      'Bambu', 'Madeira balsa', 'Cortiça', 'Inox (gravação)',
      'Anodizado', 'Vidro (gravação)', 'Pedra (gravação)', 'Personalizado'
    ],
  },
];

export function LaserCalculator() {
  const { activeStore } = useStore();
  const { user, isAdmin } = useAuth();
  const { addToast } = useToast();

  // ── Machines ────────────────────────────────────────────────────────────────
  const [machines, setMachines] = useState<LaserMachineProfile[]>([]);
  const [machinesLoading, setMachinesLoading] = useState(true);
  const [showMachineForm, setShowMachineForm] = useState(false);
  const [editingMachine, setEditingMachine] = useState<LaserMachineProfile | null>(null);
  const [newMachine, setNewMachine] = useState<Partial<LaserMachineProfile>>({
    label: '', laserType: 'Diodo', powerW: 10, powerConsumptionW: 60,
    workAreaW: 400, workAreaH: 400, maxSpeedMmMin: 10000,
    diodeLifeH: 10000, moduleReplacementCost: 300, materials: [],
  });
  const [savingMachine, setSavingMachine] = useState(false);

  // ── Job state ────────────────────────────────────────────────────────────────
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const [jobName, setJobName] = useState('');
  const [material, setMaterial] = useState('');
  const [widthMm, setWidthMm] = useState(100);
  const [heightMm, setHeightMm] = useState(100);
  const [cuttingTimeMin, setCuttingTimeMin] = useState(0);
  const [engravingTimeMin, setEngravingTimeMin] = useState(0);
  const [passes, setPasses] = useState(1);
  const [materialCost, setMaterialCost] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [hourlyRate, setHourlyRate] = useState(25);
  const [profitMarginPct, setProfitMarginPct] = useState(60);
  const [electricityRate, setElectricityRate] = useState(ELECTRICITY_RATE_DEFAULT);
  const [manualPrice, setManualPrice] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // ── AI ───────────────────────────────────────────────────────────────────────
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState('');

  // ── History ──────────────────────────────────────────────────────────────────
  const [jobs, setJobs] = useState<LaserJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [savingJob, setSavingJob] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Seed default machines ──────────────────────────────────────────────────
  const seedDefaultMachines = async (storeId: string) => {
    for (const m of DEFAULT_MACHINES) {
      const id = `default_${storeId}_${m.label.replace(/\s+/g, '_').toLowerCase()}`;
      const ref = doc(db, 'laserMachines', id);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, { ...m, id, storeId, createdAt: new Date().toISOString() });
      }
    }
  };

  // ── Firestore subs ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeStore) { setMachinesLoading(false); setLoadingJobs(false); return; }

    seedDefaultMachines(activeStore.id).catch(console.warn);

    const unsubM = onSnapshot(
      query(collection(db, 'laserMachines'), where('storeId', '==', activeStore.id), orderBy('label', 'asc')),
      snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as LaserMachineProfile));
        setMachines(list);
        if (!selectedMachineId && list.length > 0) setSelectedMachineId(list[0].id);
        setMachinesLoading(false);
      },
      err => { handleFirestoreError(err, OperationType.LIST, 'laserMachines'); setMachinesLoading(false); }
    );

    const unsubJ = onSnapshot(
      query(collection(db, 'laserJobs'), where('storeId', '==', activeStore.id), orderBy('createdAt', 'desc')),
      snap => { setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() } as LaserJob))); setLoadingJobs(false); },
      err => { handleFirestoreError(err, OperationType.LIST, 'laserJobs'); setLoadingJobs(false); }
    );

    return () => { unsubM(); unsubJ(); };
  }, [activeStore]);

  const selectedMachine = machines.find(m => m.id === selectedMachineId) ?? null;
  const totalTimeMin = (cuttingTimeMin + engravingTimeMin) * passes;
  const totalTimeH = totalTimeMin / 60;

  // ── Calculation ──────────────────────────────────────────────────────────────
  const calc = () => {
    if (!selectedMachine || totalTimeMin <= 0) return null;
    const energyCost = (selectedMachine.powerConsumptionW / 1000) * totalTimeH * electricityRate;
    const wearCost = (selectedMachine.moduleReplacementCost / selectedMachine.diodeLifeH) * totalTimeH;
    const laborCost = (hourlyRate / 60) * totalTimeMin;
    const matPerUnit = materialCost / Math.max(quantity, 1);
    const totalCostUnit = energyCost + wearCost + laborCost + matPerUnit;
    const totalCostBatch = energyCost + wearCost + laborCost + materialCost;
    const suggestedUnit = totalCostUnit * (1 + profitMarginPct / 100);
    const suggestedBatch = totalCostBatch * (1 + profitMarginPct / 100);
    const priceRef = manualPrice ?? suggestedUnit;
    const profit = priceRef - totalCostUnit;
    const margin = priceRef > 0 ? (profit / priceRef) * 100 : 0;
    return { energyCost, wearCost, laborCost, matPerUnit, totalCostUnit, totalCostBatch, suggestedUnit, suggestedBatch, profit, margin };
  };
  const result = calc();

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleSaveMachine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStore || !newMachine.label) return;
    setSavingMachine(true);
    try {
      const data = { ...newMachine, storeId: activeStore.id };
      if (editingMachine) {
        await setDoc(doc(db, 'laserMachines', editingMachine.id), { ...data, id: editingMachine.id, createdAt: editingMachine.createdAt, updatedAt: new Date().toISOString() });
        addToast('Máquina atualizada!', 'success');
      } else {
        const ref = await addDoc(collection(db, 'laserMachines'), { ...data, createdAt: new Date().toISOString() });
        await setDoc(ref, { ...data, id: ref.id, createdAt: new Date().toISOString() });
        addToast('Máquina cadastrada!', 'success');
      }
      setShowMachineForm(false);
      setEditingMachine(null);
      setNewMachine({ label: '', laserType: 'Diodo', powerW: 10, powerConsumptionW: 60, workAreaW: 400, workAreaH: 400, maxSpeedMmMin: 10000, diodeLifeH: 10000, moduleReplacementCost: 300, materials: [] });
    } catch (err) { handleFirestoreError(err, OperationType.CREATE, 'laserMachines'); }
    setSavingMachine(false);
  };

  const handleDeleteMachine = async (id: string) => {
    if (!window.confirm('Excluir esta máquina?')) return;
    try { await deleteDoc(doc(db, 'laserMachines', id)); addToast('Máquina excluída.', 'success'); }
    catch (err) { handleFirestoreError(err, OperationType.DELETE, `laserMachines/${id}`); }
  };

  const handleAnalyzeAI = async () => {
    if (!result || !jobName || !selectedMachine) return;
    const price = manualPrice ?? result.suggestedUnit;
    setAiLoading(true);
    try {
      const analysis = await analyzeLaserPrice(jobName, result.totalCostUnit, price, selectedMachine.label, material || 'não especificado');
      setAiAnalysis(analysis || '');
    } catch { setAiAnalysis('Erro ao analisar. Verifique sua conexão.'); }
    setAiLoading(false);
  };

  const handleSaveJob = async () => {
    if (!activeStore || !jobName || !material || !selectedMachine || totalTimeMin <= 0) {
      addToast('Preencha nome, material e tempo de corte/gravação.', 'error'); return;
    }
    setSavingJob(true);
    try {
      await addDoc(collection(db, 'laserJobs'), {
        storeId: activeStore.id,
        name: jobName,
        machineId: selectedMachine.id,
        machineName: selectedMachine.label,
        material, widthMm, heightMm, cuttingTimeMin, engravingTimeMin, passes,
        materialCost, quantity, manualPrice: manualPrice ?? null, notes,
        createdAt: new Date().toISOString(),
      });
      addToast('Trabalho salvo!', 'success');
      setJobName(''); setAiAnalysis(''); setManualPrice(null); setNotes('');
    } catch (err) { handleFirestoreError(err, OperationType.CREATE, 'laserJobs'); }
    setSavingJob(false);
  };

  const handleDeleteJob = async (id: string) => {
    setDeletingId(id);
    try { await deleteDoc(doc(db, 'laserJobs', id)); addToast('Trabalho excluído.', 'success'); }
    catch (err) { handleFirestoreError(err, OperationType.DELETE, `laserJobs/${id}`); }
    setDeletingId(null);
  };

  if (!activeStore) return (
    <div className="flex flex-col items-center justify-center h-96 space-y-4">
      <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center"><Zap className="w-8 h-8 text-neutral-400"/></div>
      <h2 className="text-xl font-bold text-neutral-900">Selecione uma loja</h2>
    </div>
  );

  return (
    <div className="space-y-8 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-neutral-400 mb-1"><Zap className="w-4 h-4"/><span className="text-xs font-bold uppercase tracking-widest">Calculadora</span></div>
          <h1 className="text-3xl font-black text-neutral-900">Corte a Laser</h1>
        </div>
        <button onClick={() => setShowMachineForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-neutral-100 text-neutral-900 rounded-xl hover:bg-neutral-200 transition-all text-sm font-bold">
          <Plus className="w-4 h-4"/> Nova Máquina
        </button>
      </header>

      {/* Machine selection */}
      <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm space-y-3">
        <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-2"><Settings className="w-3.5 h-3.5"/> Máquina</h2>
        {machinesLoading ? <div className="animate-pulse h-24 bg-neutral-100 rounded-xl"/> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {machines.map(m => (
              <div key={m.id} className={`relative p-4 rounded-2xl border-2 cursor-pointer transition-all ${selectedMachineId === m.id ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-100 hover:border-neutral-300'}`}
                onClick={() => { setSelectedMachineId(m.id); setMaterial(''); }}>
                <div className="flex items-start justify-between mb-2">
                  <p className="font-bold text-sm text-neutral-900 leading-tight">{m.label}</p>
                  {selectedMachineId === m.id && <CheckCircle2 className="w-4 h-4 text-neutral-900 flex-shrink-0"/>}
                </div>
                <p className="text-xs text-neutral-400">{m.laserType} · {m.powerW}W · {m.workAreaW}×{m.workAreaH}mm</p>
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  <span className="text-[10px] bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-full font-bold">{m.powerConsumptionW}W consumo</span>
                  <span className="text-[10px] bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-full font-bold">{m.diodeLifeH.toLocaleString()}h vida</span>
                </div>
                {!m.isDefault && (isAdmin || user?.role === 'GERENTE') && (
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                    <button onClick={() => { setEditingMachine(m); setNewMachine(m); setShowMachineForm(true); }} className="p-1 hover:bg-neutral-200 rounded-lg transition-all"><Edit2 className="w-3 h-3"/></button>
                    <button onClick={() => handleDeleteMachine(m.id)} className="p-1 hover:bg-red-100 rounded-lg transition-all text-red-500"><Trash2 className="w-3 h-3"/></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Job form */}
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm space-y-4">
            <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-2"><Layers className="w-3.5 h-3.5"/> Detalhes do Trabalho</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-bold text-neutral-600">Nome do Trabalho</label>
                <input type="text" value={jobName} onChange={e => setJobName(e.target.value)}
                  placeholder="Ex: Porta-chaves MDF personalizado"
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm"/>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600">Material</label>
                <select value={material} onChange={e => setMaterial(e.target.value)}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm">
                  <option value="">Selecione...</option>
                  {(selectedMachine?.materials || []).map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600">Quantidade de peças</label>
                <input type="number" min="1" value={quantity} onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm"/>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600 flex items-center gap-1.5"><span className="w-2 h-2 bg-red-400 rounded-full inline-block"/>Tempo de Corte (min)</label>
                <input type="number" min="0" step="0.5" value={cuttingTimeMin} onChange={e => setCuttingTimeMin(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm"/>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600 flex items-center gap-1.5"><span className="w-2 h-2 bg-blue-400 rounded-full inline-block"/>Tempo de Gravação (min)</label>
                <input type="number" min="0" step="0.5" value={engravingTimeMin} onChange={e => setEngravingTimeMin(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm"/>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600">Passadas</label>
                <input type="number" min="1" value={passes} onChange={e => setPasses(Math.max(1, Number(e.target.value)))}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm"/>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600">Custo do Material (R$ total)</label>
                <input type="number" min="0" step="0.01" value={materialCost} onChange={e => setMaterialCost(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm" placeholder="0,00"/>
              </div>
            </div>

            {totalTimeMin > 0 && (
              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-neutral-500"/>
                <span className="text-sm font-bold text-neutral-700">
                  {Math.floor(totalTimeMin / 60) > 0 ? `${Math.floor(totalTimeMin / 60)}h ` : ''}{(totalTimeMin % 60).toFixed(1)}min total
                  {passes > 1 ? ` (${passes} passadas)` : ''}
                </span>
              </div>
            )}

            {/* Advanced */}
            <div className="border-t border-neutral-100 pt-3">
              <button type="button" onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-xs font-bold text-neutral-400 hover:text-neutral-900 transition-colors">
                {showAdvanced ? <ChevronUp className="w-3.5 h-3.5"/> : <ChevronDown className="w-3.5 h-3.5"/>}
                Configurações Avançadas
              </button>
              {showAdvanced && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                  {[
                    { label: 'Tarifa Energia (R$/kWh)', value: electricityRate, set: setElectricityRate, step: 0.01, min: 0.1 },
                    { label: 'Valor Hora Trabalho (R$)', value: hourlyRate, set: setHourlyRate, step: 0.5, min: 0 },
                    { label: 'Margem de Lucro (%)', value: profitMarginPct, set: setProfitMarginPct, step: 1, min: 0 },
                  ].map(f => (
                    <div key={f.label} className="space-y-1">
                      <label className="text-xs font-bold text-neutral-600">{f.label}</label>
                      <input type="number" step={f.step} min={f.min} value={f.value}
                        onChange={e => f.set(Number(e.target.value))}
                        className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm"/>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm resize-none" placeholder="Observações (opcional)…"/>
          </div>

          {/* Price + AI */}
          {result && (
            <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm space-y-4">
              <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-2"><DollarSign className="w-3.5 h-3.5"/> Preço de Venda</h2>
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600">Seu preço por peça (opcional)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-bold text-sm">R$</span>
                  <input type="number" step="0.01" min="0" value={manualPrice ?? ''}
                    onChange={e => setManualPrice(e.target.value ? Number(e.target.value) : null)}
                    className="w-full pl-12 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none font-bold text-lg"
                    placeholder={formatCurrency(result.suggestedUnit)}/>
                </div>
              </div>
              {jobName && (
                <button type="button" onClick={handleAnalyzeAI} disabled={aiLoading}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-violet-600 to-purple-700 text-white rounded-xl font-bold hover:from-violet-700 hover:to-purple-800 transition-all disabled:opacity-50 shadow-lg shadow-purple-100">
                  {aiLoading ? <><Loader2 className="w-4 h-4 animate-spin"/>Analisando...</> : <><Sparkles className="w-4 h-4"/>Analisar com IA</>}
                </button>
              )}
              {aiAnalysis && (
                <div className="p-4 bg-violet-50 rounded-2xl border border-violet-100 space-y-2">
                  <div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-violet-600"/><span className="text-xs font-bold text-violet-700 uppercase">Análise IA</span></div>
                  <p className="text-sm text-violet-900 leading-relaxed whitespace-pre-line">{aiAnalysis}</p>
                </div>
              )}
              <button type="button" onClick={handleSaveJob} disabled={savingJob || !jobName || !material || totalTimeMin <= 0}
                className="w-full flex items-center justify-center gap-2 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all disabled:opacity-40">
                {savingJob ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
                Salvar Trabalho
              </button>
            </div>
          )}
        </div>

        {/* Result panel */}
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm space-y-4 sticky top-4">
            <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-2"><Calculator className="w-3.5 h-3.5"/> Resultado</h2>
            {!result ? (
              <div className="py-12 text-center text-neutral-400 text-sm italic">Preencha os tempos para calcular.</div>
            ) : (
              <div className="space-y-3">
                <div className="p-4 bg-neutral-50 rounded-xl space-y-2">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Composição / peça</p>
                  {[
                    { label: '⚡ Energia', val: result.energyCost },
                    { label: '🔧 Desgaste laser', val: result.wearCost },
                    { label: '👤 Mão de obra', val: result.laborCost },
                    { label: '📦 Material', val: result.matPerUnit },
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
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Sugerido ({profitMarginPct}%)</p>
                  <p className="text-2xl font-black text-emerald-700">{formatCurrency(result.suggestedUnit)}<span className="text-sm font-medium">/peça</span></p>
                  {quantity > 1 && <p className="text-sm text-emerald-600 font-bold mt-0.5">{formatCurrency(result.suggestedBatch)} total</p>}
                </div>

                {manualPrice != null && manualPrice > 0 && (
                  <div className={`p-4 rounded-xl border space-y-2 ${result.profit >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-red-50 border-red-100'}`}>
                    <div className="flex items-center justify-between">
                      <p className={`text-2xl font-black ${result.profit >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{formatCurrency(manualPrice)}</p>
                      {result.profit >= 0 ? <CheckCircle2 className="w-5 h-5 text-emerald-500"/> : <AlertCircle className="w-5 h-5 text-red-500"/>}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><p className="text-[10px] text-neutral-400 font-bold uppercase">Lucro</p><p className={`font-black text-sm ${result.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(result.profit)}</p></div>
                      <div><p className="text-[10px] text-neutral-400 font-bold uppercase">Margem</p><p className={`font-black text-sm ${result.margin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{result.margin.toFixed(1)}%</p></div>
                    </div>
                    {result.profit < 0 && (
                      <div className="flex items-start gap-2 p-2 bg-red-100 rounded-lg">
                        <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0"/>
                        <p className="text-xs text-red-700 font-medium">Prejuízo de {formatCurrency(Math.abs(result.profit))}/peça. Mínimo: {formatCurrency(result.totalCostUnit)}.</p>
                      </div>
                    )}
                  </div>
                )}

                {selectedMachine && (
                  <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 text-xs text-neutral-400">
                    {selectedMachine.label} · {selectedMachine.powerConsumptionW}W · {electricityRate} R$/kWh
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* History table */}
      <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-neutral-900">Trabalhos Salvos</h2>
        {loadingJobs ? <div className="animate-pulse h-24 bg-neutral-100 rounded-xl"/> : jobs.length === 0 ? (
          <p className="py-10 text-center text-neutral-400 italic text-sm">Nenhum trabalho salvo.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-neutral-100">
                {['Trabalho', 'Máquina', 'Material', 'Qtd', 'Preço', ''].map(h => (
                  <th key={h} className="text-left py-2 pr-4 text-[10px] font-black text-neutral-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {jobs.map(job => (
                  <tr key={job.id} className="border-b border-neutral-50 hover:bg-neutral-50 transition-colors">
                    <td className="py-3 pr-4 font-bold text-neutral-900">{job.name}</td>
                    <td className="py-3 pr-4 text-neutral-500 text-xs">{job.machineName || job.machineId}</td>
                    <td className="py-3 pr-4 text-neutral-500">{job.material}</td>
                    <td className="py-3 pr-4 text-right text-neutral-600">{job.quantity}</td>
                    <td className="py-3 pr-4 font-bold text-neutral-900 text-right">{job.manualPrice ? formatCurrency(job.manualPrice) : '—'}</td>
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

      {/* Info banner */}
      <div className="bg-amber-50 p-5 rounded-2xl border border-amber-100 flex gap-4">
        <div className="w-9 h-9 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0"><Info className="w-4 h-4 text-amber-600"/></div>
        <div>
          <p className="font-bold text-amber-900 text-sm mb-1">Sobre os cálculos</p>
          <p className="text-amber-700 text-xs leading-relaxed">Os tempos de corte e gravação devem ser obtidos do seu software (LightBurn, LaserGRBL). O custo de desgaste é calculado pela vida útil e custo de reposição do módulo laser. Você pode cadastrar novas máquinas e editar os perfis existentes.</p>
        </div>
      </div>

      {/* Machine form modal */}
      {showMachineForm && (
        <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-8 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-neutral-900">{editingMachine ? 'Editar Máquina' : 'Nova Máquina'}</h3>
              <button onClick={() => { setShowMachineForm(false); setEditingMachine(null); }} className="p-2 hover:bg-neutral-100 rounded-full"><X className="w-5 h-5 text-neutral-400"/></button>
            </div>
            <form onSubmit={handleSaveMachine} className="space-y-4">
              {[
                { label: 'Nome da Máquina', key: 'label', type: 'text', placeholder: 'Ex: Creality Falcon 40W' },
                { label: 'Tipo de Laser', key: 'laserType', type: 'text', placeholder: 'Ex: Diodo 455nm, CO2' },
                { label: 'Potência do Laser (W)', key: 'powerW', type: 'number' },
                { label: 'Consumo Elétrico Total (W)', key: 'powerConsumptionW', type: 'number' },
                { label: 'Área Útil Largura (mm)', key: 'workAreaW', type: 'number' },
                { label: 'Área Útil Altura (mm)', key: 'workAreaH', type: 'number' },
                { label: 'Velocidade Máx (mm/min)', key: 'maxSpeedMmMin', type: 'number' },
                { label: 'Vida Útil do Módulo (horas)', key: 'diodeLifeH', type: 'number' },
                { label: 'Custo de Reposição do Módulo (R$)', key: 'moduleReplacementCost', type: 'number' },
              ].map(f => (
                <div key={f.key} className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700">{f.label}</label>
                  <input type={f.type} placeholder={f.placeholder} required
                    value={(newMachine as any)[f.key] ?? ''}
                    onChange={e => setNewMachine(m => ({ ...m, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value }))}
                    className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm"/>
                </div>
              ))}
              <button type="submit" disabled={savingMachine}
                className="w-full py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {savingMachine ? <><Loader2 className="w-4 h-4 animate-spin"/>Salvando...</> : <><Save className="w-4 h-4"/>{editingMachine ? 'Atualizar' : 'Cadastrar'}</>}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
