import React, { useState, useEffect } from 'react';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, where, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { LaserJob, LaserMachineProfile } from '../types';
import { CALCULATOR_DEFAULTS, electricityRateOf } from '../lib/defaults';
import { channelFees, channelsOf, findChannel } from '../lib/channels';
import { useCostBase, useCostBaseDefaults } from '../hooks/useCostBase';
import { formatCurrency } from '../lib/utils';
import { clampMarkup, realMargin, markupOf } from '../lib/pricingEngine';
import { calcLaserJob, laserTotalTimeMin } from '../lib/calculators';
import { useStore } from '../contexts/StoreContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { JobHistoryList } from './JobHistoryList';
import { SaveAndCreateProductButton, useJobProduct } from './JobProduct';
import { ManualPriceCheck, SuggestedPrice } from './PriceResultCard';
import { ChannelProfitTable } from './ChannelProfitTable';
import { analyzeLaserPrice } from '../services/gemini';
import {
  Zap,
  Calculator,
  Sparkles,
  Trash2,
  Plus,
  X,
  Loader2,
  Clock,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  Settings,
  Layers,
  ChevronDown,
  ChevronUp,
  Info,
  Edit2,
  Save,
} from 'lucide-react';

// Materiais da máquina são digitados separados por vírgula ("MDF 3mm, Acrílico 3mm").
const parseMaterials = (text: string) =>
  Array.from(
    new Set(
      text
        .split(',')
        .map(item => item.trim())
        .filter(Boolean),
    ),
  );

export function LaserCalculator({ onOpenProduct }: { onOpenProduct?: (productId: string) => void } = {}) {
  // Etapa 8C, item 4: trabalho salvo vira produto (com confirmação).
  const jobProduct = useJobProduct('laser', onOpenProduct);
  const { activeStore } = useStore();
  const { user, isAdmin } = useAuth();
  const { addToast } = useToast();

  // ── Machines ────────────────────────────────────────────────────────────────
  const [machines, setMachines] = useState<LaserMachineProfile[]>([]);
  const [machinesLoading, setMachinesLoading] = useState(true);
  const [showMachineForm, setShowMachineForm] = useState(false);
  const [editingMachine, setEditingMachine] = useState<LaserMachineProfile | null>(null);
  const [newMachine, setNewMachine] = useState<Partial<LaserMachineProfile>>({
    label: '',
    laserType: 'Diodo',
    powerW: 10,
    powerConsumptionW: 60,
    workAreaW: 400,
    workAreaH: 400,
    maxSpeedMmMin: 10000,
    diodeLifeH: 10000,
    moduleReplacementCost: 300,
    materials: [],
  });
  const [machineMaterialsText, setMachineMaterialsText] = useState('');
  const [savingMachine, setSavingMachine] = useState(false);

  // ── Job state ────────────────────────────────────────────────────────────────
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const [jobName, setJobName] = useState('');
  const [material, setMaterial] = useState('');
  const [cuttingTimeMin, setCuttingTimeMin] = useState(0);
  const [engravingTimeMin, setEngravingTimeMin] = useState(0);
  const [passes, setPasses] = useState(1);
  const [materialCost, setMaterialCost] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [hourlyRate, setHourlyRate] = useState(CALCULATOR_DEFAULTS.laser.hourlyRate);
  const [markupPct, setMarkupPct] = useState(CALCULATOR_DEFAULTS.laser.markupPct);
  // Canal de venda (tabela da Base de Custos); começa em Venda Direta, sem taxa.
  const { costs } = useCostBase();
  // T2: abre com o valor da hora e o markup da Base de Custos da loja (campos continuam editáveis).
  useCostBaseDefaults(costs, c => {
    if (Number(c.hourlyRate) > 0) setHourlyRate(Math.round(Number(c.hourlyRate) * 100) / 100);
    setMarkupPct(Math.round(markupOf(c) * 100) / 100);
    // Etapa 7.2: tarifa de energia da loja.
    setElectricityRate(electricityRateOf(c));
  });
  const channels = channelsOf(costs);
  const [channelId, setChannelId] = useState('venda-direta');
  const selectedChannel = findChannel(channels, channelId);
  const { feePct: channelFeePct, fixedFee: channelFixedFee } = channelFees(selectedChannel);
  const [electricityRate, setElectricityRate] = useState(CALCULATOR_DEFAULTS.laser.electricityRate);
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

  // ── Firestore subs ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeStore) {
      setMachinesLoading(false);
      setLoadingJobs(false);
      return;
    }

    const unsubM = onSnapshot(
      query(collection(db, 'laserMachines'), where('storeId', '==', activeStore.id), orderBy('label', 'asc')),
      snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }) as LaserMachineProfile);
        setMachines(list);
        setSelectedMachineId(current => (list.some(machine => machine.id === current) ? current : (list[0]?.id ?? '')));
        setMachinesLoading(false);
      },
      err => {
        handleFirestoreError(err, OperationType.LIST, 'laserMachines');
        setMachinesLoading(false);
      },
    );

    const unsubJ = onSnapshot(
      query(collection(db, 'laserJobs'), where('storeId', '==', activeStore.id), orderBy('createdAt', 'desc')),
      snap => {
        setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() }) as LaserJob));
        setLoadingJobs(false);
      },
      err => {
        handleFirestoreError(err, OperationType.LIST, 'laserJobs');
        setLoadingJobs(false);
      },
    );

    return () => {
      unsubM();
      unsubJ();
    };
  }, [activeStore]);

  const selectedMachine = machines.find(m => m.id === selectedMachineId) ?? null;
  const totalTimeMin = laserTotalTimeMin(cuttingTimeMin, engravingTimeMin, passes);

  // ── Calculation ──────────────────────────────────────────────────────────────
  const result = selectedMachine
    ? calcLaserJob({
        powerConsumptionW: selectedMachine.powerConsumptionW,
        moduleReplacementCost: selectedMachine.moduleReplacementCost,
        diodeLifeH: selectedMachine.diodeLifeH,
        cuttingTimeMin,
        engravingTimeMin,
        passes,
        electricityRate,
        hourlyRate,
        materialCost,
        quantity,
        markupPct,
        channelFeePct,
        channelFixedFee,
        manualPrice,
      })
    : null;

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleSaveMachine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStore || !newMachine.label) return;
    setSavingMachine(true);
    try {
      const data = { ...newMachine, materials: parseMaterials(machineMaterialsText), storeId: activeStore.id };
      if (editingMachine) {
        await setDoc(doc(db, 'laserMachines', editingMachine.id), {
          ...data,
          id: editingMachine.id,
          createdAt: editingMachine.createdAt,
          updatedAt: new Date().toISOString(),
        });
        addToast('Máquina atualizada!', 'success');
      } else {
        const ref = await addDoc(collection(db, 'laserMachines'), { ...data, createdAt: new Date().toISOString() });
        await setDoc(ref, { ...data, id: ref.id, createdAt: new Date().toISOString() });
        addToast('Máquina cadastrada!', 'success');
      }
      setShowMachineForm(false);
      setEditingMachine(null);
      setNewMachine({
        label: '',
        laserType: 'Diodo',
        powerW: 10,
        powerConsumptionW: 60,
        workAreaW: 400,
        workAreaH: 400,
        maxSpeedMmMin: 10000,
        diodeLifeH: 10000,
        moduleReplacementCost: 300,
        materials: [],
      });
      setMachineMaterialsText('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'laserMachines');
    }
    setSavingMachine(false);
  };

  const handleDeleteMachine = async (machine: LaserMachineProfile) => {
    if (!window.confirm(`Excluir a máquina \"${machine.label}\"? Os trabalhos já salvos continuarão no histórico.`))
      return;
    try {
      await deleteDoc(doc(db, 'laserMachines', machine.id));
      if (selectedMachineId === machine.id) {
        setSelectedMachineId(machines.find(item => item.id !== machine.id)?.id ?? '');
        setMaterial('');
      }
      addToast('Máquina excluída.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `laserMachines/${machine.id}`);
    }
  };

  const handleAnalyzeAI = async () => {
    if (!result || !jobName || !selectedMachine) return;
    const price = manualPrice ?? result.suggestedUnit;
    setAiLoading(true);
    try {
      const analysis = await analyzeLaserPrice(
        jobName,
        result.totalCostUnit,
        price,
        selectedMachine.label,
        material || 'não especificado',
      );
      setAiAnalysis(analysis || '');
    } catch {
      setAiAnalysis('Erro ao analisar. Verifique sua conexão.');
    }
    setAiLoading(false);
  };

  const handleSaveJob = async (createProduct = false) => {
    if (!activeStore || !jobName || !material || !selectedMachine || totalTimeMin <= 0) {
      addToast('Preencha nome, material e tempo de corte/gravação.', 'error');
      return;
    }
    setSavingJob(true);
    try {
      const job = {
        storeId: activeStore.id,
        channel: selectedChannel?.name ?? 'Venda Direta',
        name: jobName,
        machineId: selectedMachine.id,
        machineName: selectedMachine.label,
        material,
        cuttingTimeMin,
        engravingTimeMin,
        passes,
        materialCost,
        quantity,
        manualPrice: manualPrice ?? null,
        // Etapa 8C, item 4: custo e preço que valiam ao salvar (o trabalho vira produto sem recalcular).
        totalCostUnit: result?.totalCostUnit ?? 0,
        unitPrice: manualPrice ?? result?.suggestedUnit ?? 0,
        notes,
        createdAt: new Date().toISOString(),
      };
      const ref = await addDoc(collection(db, 'laserJobs'), job);
      addToast('Trabalho salvo!', 'success');
      if (createProduct) jobProduct.createAfterSave({ ...job, id: ref.id });
      setJobName('');
      setAiAnalysis('');
      setManualPrice(null);
      setNotes('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'laserJobs');
    }
    setSavingJob(false);
  };

  const handleDeleteJob = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteDoc(doc(db, 'laserJobs', id));
      addToast('Trabalho excluído.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `laserJobs/${id}`);
    }
    setDeletingId(null);
  };

  if (!activeStore)
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center">
          <Zap className="w-8 h-8 text-neutral-400" />
        </div>
        <h2 className="text-xl font-bold text-neutral-900">Selecione uma loja</h2>
      </div>
    );

  return (
    <div className="space-y-8 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-neutral-400 mb-1">
            <Zap className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-widest">Calculadora</span>
          </div>
          <h1 className="text-3xl font-black text-neutral-900">Corte a Laser</h1>
        </div>
        {(isAdmin || user?.role === 'GERENTE') && (
          <button
            onClick={() => {
              setEditingMachine(null);
              setNewMachine({
                label: '',
                laserType: 'Diodo',
                powerW: 10,
                powerConsumptionW: 60,
                workAreaW: 400,
                workAreaH: 400,
                maxSpeedMmMin: 10000,
                diodeLifeH: 10000,
                moduleReplacementCost: 300,
                materials: [],
              });
              setMachineMaterialsText('');
              setShowMachineForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-neutral-100 text-neutral-900 rounded-xl hover:bg-neutral-200 transition-all text-sm font-bold"
          >
            <Plus className="w-4 h-4" /> Nova Máquina
          </button>
        )}
      </header>

      {/* Machine selection */}
      <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm space-y-3">
        <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-2">
          <Settings className="w-3.5 h-3.5" /> Máquina
        </h2>
        {machinesLoading ? (
          <div className="animate-pulse h-24 bg-neutral-100 rounded-xl" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {machines.length === 0 && (
              <p className="text-sm text-neutral-500 md:col-span-2 lg:col-span-3">
                Nenhuma máquina cadastrada. Administradores e gerentes podem adicionar a primeira.
              </p>
            )}
            {machines.map(m => (
              <div
                key={m.id}
                className={`relative p-4 rounded-2xl border-2 cursor-pointer transition-all ${selectedMachineId === m.id ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-100 hover:border-neutral-300'}`}
                onClick={() => {
                  setSelectedMachineId(m.id);
                  setMaterial('');
                }}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="font-bold text-sm text-neutral-900 leading-tight">{m.label}</p>
                  {selectedMachineId === m.id && <CheckCircle2 className="w-4 h-4 text-neutral-900 flex-shrink-0" />}
                </div>
                <p className="text-xs text-neutral-400">
                  {m.laserType} · {m.powerW}W · {m.workAreaW}×{m.workAreaH}mm
                </p>
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  <span className="text-[10px] bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-full font-bold">
                    {m.powerConsumptionW}W consumo
                  </span>
                  <span className="text-[10px] bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-full font-bold">
                    {m.diodeLifeH.toLocaleString()}h vida
                  </span>
                </div>
                {(isAdmin || user?.role === 'GERENTE') && (
                  // Etapa 8B: no rodapé do cartão (igual à Impressão 3D), longe do check de selecionada.
                  <div
                    className="flex items-center gap-2 mt-3 pt-3 border-t border-neutral-100"
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      title="Editar máquina"
                      aria-label={`Editar ${m.label}`}
                      onClick={() => {
                        setEditingMachine(m);
                        setNewMachine(m);
                        setMachineMaterialsText((m.materials || []).join(', '));
                        setShowMachineForm(true);
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Editar
                    </button>
                    <button
                      type="button"
                      title="Excluir máquina"
                      aria-label={`Excluir ${m.label}`}
                      onClick={() => handleDeleteMachine(m)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Excluir
                    </button>
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
            <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-3.5 h-3.5" /> Detalhes do Trabalho
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-bold text-neutral-600">Nome do Trabalho</label>
                <input
                  type="text"
                  value={jobName}
                  onChange={e => setJobName(e.target.value)}
                  placeholder="Ex: Porta-chaves MDF personalizado"
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600">Material</label>
                {(selectedMachine?.materials || []).length > 0 ? (
                  <select
                    value={material}
                    onChange={e => setMaterial(e.target.value)}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm"
                  >
                    <option value="">Selecione...</option>
                    {(selectedMachine?.materials || []).map(m => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                ) : (
                  // Máquina sem lista de materiais: permite digitar para não travar o salvamento.
                  <input
                    type="text"
                    value={material}
                    onChange={e => setMaterial(e.target.value)}
                    placeholder="Ex: MDF 3mm"
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm"
                  />
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600">Quantidade de peças</label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600 flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-red-400 rounded-full inline-block" />
                  Tempo de Corte por peça (min)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={cuttingTimeMin}
                  onChange={e => setCuttingTimeMin(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600 flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-blue-400 rounded-full inline-block" />
                  Tempo de Gravação por peça (min)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={engravingTimeMin}
                  onChange={e => setEngravingTimeMin(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600">Passadas</label>
                <input
                  type="number"
                  min="1"
                  value={passes}
                  onChange={e => setPasses(Math.max(1, Number(e.target.value)))}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600">Custo do Material (R$ total)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={materialCost}
                  onChange={e => setMaterialCost(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm"
                  placeholder="0,00"
                />
              </div>
            </div>

            {totalTimeMin > 0 && (
              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-neutral-500" />
                <span className="text-sm font-bold text-neutral-700">
                  {Math.floor(totalTimeMin / 60) > 0 ? `${Math.floor(totalTimeMin / 60)}h ` : ''}
                  {(totalTimeMin % 60).toFixed(1)}min por peça
                  {passes > 1 ? ` (${passes} passadas)` : ''}
                </span>
              </div>
            )}

            {/* Advanced */}
            <div className="border-t border-neutral-100 pt-3">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-xs font-bold text-neutral-400 hover:text-neutral-900 transition-colors"
              >
                {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                Configurações Avançadas
              </button>
              {showAdvanced && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                  {[
                    {
                      label: 'Tarifa Energia (R$/kWh)',
                      value: electricityRate,
                      set: setElectricityRate,
                      step: 0.01,
                      min: 0.1,
                    },
                    { label: 'Valor Hora Trabalho (R$)', value: hourlyRate, set: setHourlyRate, step: 0.5, min: 0 },
                    {
                      label: 'Markup (% sobre o custo)',
                      value: markupPct,
                      set: (v: number) => setMarkupPct(clampMarkup(v)),
                      step: 1,
                      min: 0,
                    },
                  ].map(f => (
                    <div key={f.label} className="space-y-1">
                      <label className="text-xs font-bold text-neutral-600">{f.label}</label>
                      <input
                        type="number"
                        step={f.step}
                        min={f.min}
                        value={f.value}
                        onChange={e => f.set(Number(e.target.value))}
                        className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-600">Canal de venda</label>
              <select
                value={channelId}
                onChange={e => setChannelId(e.target.value)}
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm"
              >
                {channels.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm resize-none"
              placeholder="Observações (opcional)…"
            />
          </div>

          {/* Price + AI */}
          {result && (
            <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm space-y-4">
              <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-2">
                <DollarSign className="w-3.5 h-3.5" /> Preço de Venda
              </h2>
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600">Seu preço por peça (opcional)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-bold text-sm">
                    R$
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={manualPrice ?? ''}
                    onChange={e => setManualPrice(e.target.value ? Number(e.target.value) : null)}
                    className="w-full pl-12 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none font-bold text-lg"
                    placeholder={formatCurrency(result.suggestedUnit)}
                  />
                </div>
              </div>
              {jobName && (
                <button
                  type="button"
                  onClick={handleAnalyzeAI}
                  disabled={aiLoading}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-violet-600 to-purple-700 text-white rounded-xl font-bold hover:from-violet-700 hover:to-purple-800 transition-all disabled:opacity-50 shadow-lg shadow-purple-100"
                >
                  {aiLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analisando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Analisar com IA
                    </>
                  )}
                </button>
              )}
              {aiAnalysis && (
                <div className="p-4 bg-violet-50 rounded-2xl border border-violet-100 space-y-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-violet-600" />
                    <span className="text-xs font-bold text-violet-700 uppercase">Análise IA</span>
                  </div>
                  <p className="text-sm text-violet-900 leading-relaxed whitespace-pre-line">{aiAnalysis}</p>
                </div>
              )}
              <button
                type="button"
                onClick={() => handleSaveJob()}
                disabled={savingJob || !jobName || !material || totalTimeMin <= 0}
                className="w-full flex items-center justify-center gap-2 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all disabled:opacity-40"
              >
                {savingJob ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar Trabalho
              </button>
              <SaveAndCreateProductButton
                onClick={() => handleSaveJob(true)}
                disabled={savingJob || !jobName || !material || totalTimeMin <= 0}
              />
            </div>
          )}
        </div>

        {/* Result panel */}
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm space-y-4 sticky top-4">
            <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-2">
              <Calculator className="w-3.5 h-3.5" /> Resultado
            </h2>
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
                    <span>Custo / peça</span>
                    <span>{formatCurrency(result.totalCostUnit)}</span>
                  </div>
                </div>

                <SuggestedPrice
                  markupPct={markupPct}
                  realMarginPct={realMargin(result.suggestedUnit, result.totalCostUnit, channelFeePct, channelFixedFee)}
                  suggestedUnit={result.suggestedUnit}
                  suggestedBatch={result.suggestedBatch}
                  quantity={quantity}
                  unit="/peça"
                />

                <ManualPriceCheck manualPrice={manualPrice} profit={result.profit} margin={result.margin}>
                  Prejuízo de {formatCurrency(Math.abs(result.profit))}/peça. Mínimo:{' '}
                  {formatCurrency(result.totalCostUnit)}.
                </ManualPriceCheck>
                <ChannelProfitTable
                  price={manualPrice}
                  cost={result.totalCostUnit}
                  channels={channels}
                  markupPct={markupPct}
                  selectedChannelId={selectedChannel?.id}
                />

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
      <JobHistoryList
        title="Trabalhos Salvos"
        emptyText="Nenhum trabalho salvo."
        headers={['Trabalho', 'Máquina', 'Material', 'Qtd', 'Preço', '']}
        extraCells={job => (
          <>
            <td className="py-3 pr-4 text-neutral-500 text-xs">{job.machineName || job.machineId}</td>
            <td className="py-3 pr-4 text-neutral-500">{job.material}</td>
          </>
        )}
        noPrice="—"
        jobs={jobs}
        loading={loadingJobs}
        canDelete={isAdmin || user?.role === 'GERENTE'}
        deletingId={deletingId}
        onDelete={handleDeleteJob}
        rowActions={job =>
          jobProduct.actions(
            job,
            machines.some(m => m.id === job.machineId),
          )
        }
      />
      {jobProduct.modal}

      {/* Info banner */}
      <div className="bg-amber-50 p-5 rounded-2xl border border-amber-100 flex gap-4">
        <div className="w-9 h-9 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
          <Info className="w-4 h-4 text-amber-600" />
        </div>
        <div>
          <p className="font-bold text-amber-900 text-sm mb-1">Sobre os cálculos</p>
          <p className="text-amber-700 text-xs leading-relaxed">
            Os tempos de corte e gravação devem ser obtidos do seu software (LightBurn, LaserGRBL). O custo de desgaste
            é calculado pela vida útil e custo de reposição do módulo laser. Você pode cadastrar novas máquinas e editar
            os perfis existentes.
          </p>
        </div>
      </div>

      {/* Machine form modal */}
      {showMachineForm && (
        <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-8 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-neutral-900">
                {editingMachine ? 'Editar Máquina' : 'Nova Máquina'}
              </h3>
              <button
                onClick={() => {
                  setShowMachineForm(false);
                  setEditingMachine(null);
                }}
                className="p-2 hover:bg-neutral-100 rounded-full"
              >
                <X className="w-5 h-5 text-neutral-400" />
              </button>
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
                  <input
                    type={f.type}
                    placeholder={f.placeholder}
                    required
                    value={(newMachine as any)[f.key] ?? ''}
                    onChange={e =>
                      setNewMachine(m => ({
                        ...m,
                        [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm"
                  />
                </div>
              ))}
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-700">Materiais que a máquina trabalha</label>
                <input
                  type="text"
                  placeholder="Ex: MDF 3mm, Acrílico 3mm, Couro"
                  value={machineMaterialsText}
                  onChange={e => setMachineMaterialsText(e.target.value)}
                  className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm"
                />
                <p className="text-[10px] text-neutral-400">
                  Separe por vírgula. Aparecem na lista de materiais do trabalho.
                </p>
              </div>
              <div className="sticky -bottom-8 -mx-8 -mb-8 px-8 pb-8 bg-white pt-4 border-t border-neutral-100">
                <button
                  type="submit"
                  disabled={savingMachine}
                  className="w-full py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {savingMachine ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {editingMachine ? 'Atualizar' : 'Cadastrar'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
