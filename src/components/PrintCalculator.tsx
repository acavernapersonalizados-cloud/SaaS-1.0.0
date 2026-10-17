import React, { useState, useEffect, useRef } from 'react';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  where,
  setDoc,
  runTransaction,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Material, PrintJob, PrinterProfile } from '../types';
import { formatCurrency } from '../lib/utils';
import { clampMargin } from '../lib/pricingEngine';
import { calculatePrintPrice, getPrintChannel, parsePrintGcode, PRINT_CHANNELS } from '../lib/printPricing';
import { useStore } from '../contexts/StoreContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  Box,
  Plus,
  Trash2,
  X,
  Loader2,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Settings,
  ChevronDown,
  ChevronUp,
  Info,
  Edit2,
  Save,
  Layers,
  Calculator,
  Clock,
  Upload,
} from 'lucide-react';

const ELECTRICITY_RATE_DEFAULT = 0.85;

const FILAMENTS = [
  'PLA',
  'PLA+',
  'PETG',
  'ABS',
  'ASA',
  'TPU',
  'Nylon',
  'Resina Standard',
  'Resina ABS-Like',
  'Resina Flex',
  'Fibra de Carbono',
  'Wood Fill',
  'Personalizado',
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
    label: '',
    brand: '',
    model: '',
    powerConsumptionW: 200,
    buildVolumeX: 220,
    buildVolumeY: 220,
    buildVolumeZ: 250,
    maxSpeedMmS: 100,
    hotendReplacementCost: 80,
    hotendLifeH: 500,
    bedReplacementCost: 60,
    bedLifeH: 2000,
    maintenanceCostPerH: 0.1,
    acquisitionCost: 0,
    lifetimeHours: 5000,
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
  const [postProcessHours, setPostProcessHours] = useState(0);
  const [packagingCost, setPackagingCost] = useState(0);
  const [extrasCost, setExtrasCost] = useState(0);
  const [channelId, setChannelId] = useState('direct');
  const [fees, setFees] = useState(getPrintChannel('direct').fees);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialId, setMaterialId] = useState('');
  const [deductStock, setDeductStock] = useState(false);
  const [gcodeInfo, setGcodeInfo] = useState('');
  const [gcodeFileName, setGcodeFileName] = useState('');
  const [gcodeSlicer, setGcodeSlicer] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [notes, setNotes] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState('');

  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [savingJob, setSavingJob] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeStore) {
      setPrintersLoading(false);
      setLoadingJobs(false);
      return;
    }

    const unsubP = onSnapshot(
      query(collection(db, 'printers'), where('storeId', '==', activeStore.id), orderBy('label', 'asc')),
      snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }) as PrinterProfile);
        setPrinters(list);
        setSelectedPrinterId(current => (list.some(printer => printer.id === current) ? current : (list[0]?.id ?? '')));
        setPrintersLoading(false);
      },
      err => {
        handleFirestoreError(err, OperationType.LIST, 'printers');
        setPrintersLoading(false);
      },
    );

    const unsubMaterials = onSnapshot(
      query(collection(db, 'materials'), where('storeId', '==', activeStore.id), orderBy('name', 'asc')),
      snap => setMaterials(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Material)),
      err => handleFirestoreError(err, OperationType.LIST, 'materials'),
    );

    const unsubJ = onSnapshot(
      query(collection(db, 'printJobs'), where('storeId', '==', activeStore.id), orderBy('createdAt', 'desc')),
      snap => {
        setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() }) as PrintJob));
        setLoadingJobs(false);
      },
      err => {
        handleFirestoreError(err, OperationType.LIST, 'printJobs');
        setLoadingJobs(false);
      },
    );

    return () => {
      unsubP();
      unsubMaterials();
      unsubJ();
    };
  }, [activeStore]);

  const selectedPrinter = printers.find(p => p.id === selectedPrinterId) ?? null;

  const calc = () => {
    if (!selectedPrinter || printTimeH <= 0) return null;
    return calculatePrintPrice({
      filamentUsedG,
      filamentCostPerKg,
      printTimeH,
      powerConsumptionW: selectedPrinter.powerConsumptionW,
      electricityRate,
      acquisitionCost: selectedPrinter.acquisitionCost,
      lifetimeHours: selectedPrinter.lifetimeHours,
      hotendReplacementCost: selectedPrinter.hotendReplacementCost,
      hotendLifeH: selectedPrinter.hotendLifeH,
      bedReplacementCost: selectedPrinter.bedReplacementCost,
      bedLifeH: selectedPrinter.bedLifeH,
      maintenanceCostPerH: selectedPrinter.maintenanceCostPerH,
      hourlyRate,
      postProcessHours,
      failureRatePct,
      packagingCost,
      extrasCost,
      profitMarginPct,
      quantity,
      manualPrice,
      fees,
    });
  };
  const result = calc();

  const handleChannelChange = (value: string) => {
    setChannelId(value);
    setFees({ ...getPrintChannel(value).fees });
  };

  const handleGcode = async (file: File) => {
    const parsed = parsePrintGcode(await file.text());
    if (parsed.printTimeH === null && parsed.filamentUsedG === null) {
      addToast('Não encontrei tempo nem peso neste arquivo.', 'error');
      return;
    }
    if (parsed.printTimeH !== null) setPrintTimeH(Number(parsed.printTimeH.toFixed(2)));
    if (parsed.filamentUsedG !== null) setFilamentUsedG(Number(parsed.filamentUsedG.toFixed(2)));
    if (!jobName) setJobName(file.name.replace(/\.(gcode|gco|g|3mf)$/i, ''));
    setGcodeFileName(file.name);
    setGcodeSlicer(parsed.slicer);
    setGcodeInfo(`${file.name}${parsed.slicer ? ` · ${parsed.slicer}` : ''}`);
    addToast('Arquivo lido com sucesso.', 'success');
  };

  const handleSavePrinter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStore || !newPrinter.label?.trim()) {
      addToast('Informe o nome da impressora.', 'error');
      return;
    }
    setSavingPrinter(true);
    try {
      const data = {
        ...emptyPrinter,
        ...newPrinter,
        label: newPrinter.label.trim(),
        brand: newPrinter.brand?.trim() ?? '',
        model: newPrinter.model?.trim() ?? '',
        storeId: activeStore.id,
      };
      if (editingPrinter) {
        await setDoc(
          doc(db, 'printers', editingPrinter.id),
          {
            ...data,
            id: editingPrinter.id,
            createdAt: editingPrinter.createdAt ?? new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          { merge: true },
        );
        addToast('Impressora atualizada!', 'success');
      } else {
        const ref = await addDoc(collection(db, 'printers'), data);
        await setDoc(ref, { ...data, id: ref.id, createdAt: new Date().toISOString() });
        addToast('Impressora cadastrada!', 'success');
      }
      setShowPrinterForm(false);
      setEditingPrinter(null);
      setNewPrinter(emptyPrinter);
    } catch (err) {
      try {
        handleFirestoreError(
          err,
          editingPrinter ? OperationType.UPDATE : OperationType.CREATE,
          editingPrinter ? `printers/${editingPrinter.id}` : 'printers',
        );
      } catch {
        /* o helper já exibiu a mensagem */
      }
    } finally {
      setSavingPrinter(false);
    }
  };

  const handleDeletePrinter = async (printer: PrinterProfile) => {
    if (!window.confirm(`Excluir a impressora \"${printer.label}\"? Os trabalhos já salvos continuarão no histórico.`))
      return;
    try {
      await deleteDoc(doc(db, 'printers', printer.id));
      if (selectedPrinterId === printer.id) {
        setSelectedPrinterId(printers.find(item => item.id !== printer.id)?.id ?? '');
      }
      addToast('Impressora excluída.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `printers/${printer.id}`);
    }
  };

  const handleSaveJob = async () => {
    if (!activeStore || !jobName || !selectedPrinter || printTimeH <= 0) {
      addToast('Preencha nome e tempo de impressão.', 'error');
      return;
    }
    setSavingJob(true);
    try {
      const jobRef = doc(collection(db, 'printJobs'));
      const payload = {
        id: jobRef.id,
        storeId: activeStore.id,
        name: jobName,
        printerId: selectedPrinter.id,
        printerName: selectedPrinter.label,
        filamentType,
        filamentCostPerKg,
        filamentUsedG,
        printTimeH,
        failureRatePct,
        quantity,
        manualPrice: manualPrice ?? null,
        notes,
        materialId: materialId || null,
        postProcessHours,
        packagingCost,
        extrasCost,
        gcodeFileName: gcodeFileName || null,
        gcodeSlicer,
        channelId,
        channelCommissionPercent: fees.commissionPercent,
        channelPaymentPercent: fees.paymentPercent,
        channelFixedFee: fees.fixedFee,
        logisticsCost: fees.logisticsCost,
        suggestedPrice: result?.suggestedUnit ?? 0,
        totalCostUnit: result?.totalCostUnit ?? 0,
        createdAt: new Date().toISOString(),
      };
      if (deductStock && materialId) {
        const selectedMaterial = materials.find(item => item.id === materialId);
        if (!selectedMaterial) throw new Error('Material selecionado não encontrado.');
        // O peso do filamento está em gramas: só dá para baixar de materiais em kg ou g.
        const unit = (selectedMaterial.unit || '').toLowerCase();
        if (unit !== 'kg' && unit !== 'g') {
          throw new Error(
            `Não foi possível baixar o estoque: o material está em "${selectedMaterial.unit}". Use kg ou g para filamento.`,
          );
        }
        const amount = unit === 'kg' ? (filamentUsedG * quantity) / 1000 : filamentUsedG * quantity;
        await runTransaction(db, async transaction => {
          const materialRef = doc(db, 'materials', materialId);
          const snapshot = await transaction.get(materialRef);
          if (!snapshot.exists()) throw new Error('Material selecionado não encontrado.');
          const currentStock = Number(snapshot.data().stockQuantity) || 0;
          if (currentStock < amount) throw new Error('Estoque insuficiente para registrar esta impressão.');
          transaction.update(materialRef, {
            stockQuantity: currentStock - amount,
            updatedAt: new Date().toISOString(),
          });
          transaction.set(jobRef, payload);
        });
      } else {
        await setDoc(jobRef, payload);
      }
      addToast('Trabalho salvo!', 'success');
      setJobName('');
      setAiAnalysis('');
      setManualPrice(null);
      setNotes('');
      setGcodeInfo('');
      setGcodeFileName('');
      setGcodeSlicer(null);
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message.includes('Estoque insuficiente') ||
          err.message.includes('não encontrado') ||
          err.message.includes('Não foi possível baixar'))
      )
        addToast(err.message, 'error');
      else handleFirestoreError(err, OperationType.CREATE, 'printJobs');
    }
    setSavingJob(false);
  };

  const handleDeleteJob = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteDoc(doc(db, 'printJobs', id));
      addToast('Trabalho excluído.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `printJobs/${id}`);
    }
    setDeletingId(null);
  };

  if (!activeStore)
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center">
          <Box className="w-8 h-8 text-neutral-400" />
        </div>
        <h2 className="text-xl font-bold">Selecione uma loja</h2>
      </div>
    );

  return (
    <div className="space-y-8 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-neutral-400 mb-1">
            <Box className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-widest">Calculadora</span>
          </div>
          <h1 className="text-3xl font-black text-neutral-900">Impressão 3D</h1>
        </div>
        {(isAdmin || user?.role === 'GERENTE') && (
          <button
            onClick={() => {
              setEditingPrinter(null);
              setNewPrinter(emptyPrinter);
              setShowPrinterForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-neutral-100 text-neutral-900 rounded-xl hover:bg-neutral-200 transition-all text-sm font-bold"
          >
            <Plus className="w-4 h-4" /> Nova Impressora
          </button>
        )}
      </header>

      {/* Printer selection */}
      <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm space-y-3">
        <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-2">
          <Settings className="w-3.5 h-3.5" /> Impressora
        </h2>
        {printersLoading ? (
          <div className="animate-pulse h-24 bg-neutral-100 rounded-xl" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {printers.length === 0 && (
              <p className="text-sm text-neutral-500 md:col-span-2 lg:col-span-3">
                Nenhuma impressora cadastrada. Administradores e gerentes podem adicionar a primeira.
              </p>
            )}
            {printers.map(p => (
              <div
                key={p.id}
                className={`relative p-4 rounded-2xl border-2 cursor-pointer transition-all ${selectedPrinterId === p.id ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-100 hover:border-neutral-300'}`}
                onClick={() => setSelectedPrinterId(p.id)}
              >
                <div className="flex items-start justify-between gap-3 mb-1">
                  <p className="font-bold text-sm text-neutral-900 leading-tight">{p.label}</p>
                  {selectedPrinterId === p.id && <CheckCircle2 className="w-4 h-4 text-neutral-900 flex-shrink-0" />}
                </div>
                <p className="text-xs text-neutral-400">
                  {p.brand} {p.model} · {p.powerConsumptionW}W
                </p>
                <p className="text-xs text-neutral-400">
                  {p.buildVolumeX}×{p.buildVolumeY}×{p.buildVolumeZ}mm
                </p>
                {(isAdmin || user?.role === 'GERENTE') && (
                  <div
                    className="flex items-center gap-2 mt-3 pt-3 border-t border-neutral-100"
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      title="Editar impressora"
                      aria-label={`Editar ${p.label}`}
                      onClick={() => {
                        setEditingPrinter(p);
                        setNewPrinter({ ...emptyPrinter, ...p });
                        setShowPrinterForm(true);
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Editar
                    </button>
                    <button
                      type="button"
                      title="Excluir impressora"
                      aria-label={`Excluir ${p.label}`}
                      onClick={() => handleDeletePrinter(p)}
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
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm space-y-4">
            <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-3.5 h-3.5" /> Parâmetros de Impressão
            </h2>

            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 flex flex-wrap items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept=".gcode,.gco,.g,.3mf,text/plain"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) void handleGcode(file);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2.5 bg-neutral-900 text-white rounded-lg text-xs font-bold hover:bg-neutral-800"
              >
                <Upload className="w-3.5 h-3.5" /> Importar arquivo G-code
              </button>
              <span className="text-xs text-neutral-500">{gcodeInfo || 'Preenche peso e tempo automaticamente.'}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-bold text-neutral-600">Nome do Trabalho</label>
                <input
                  type="text"
                  value={jobName}
                  onChange={e => setJobName(e.target.value)}
                  placeholder="Ex: Vaso de planta PLA branco"
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600">Filamento</label>
                <select
                  value={filamentType}
                  onChange={e => setFilamentType(e.target.value)}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm"
                >
                  {FILAMENTS.map(f => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600">Material do estoque (opcional)</label>
                <select
                  value={materialId}
                  onChange={e => {
                    const id = e.target.value;
                    setMaterialId(id);
                    const selected = materials.find(item => item.id === id);
                    if (selected) {
                      setFilamentType(selected.name);
                      if (selected.unitCost > 0)
                        setFilamentCostPerKg(
                          selected.unit.toLowerCase() === 'kg' ? selected.unitCost : selected.unitCost * 1000,
                        );
                    }
                  }}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none text-sm"
                >
                  <option value="">Sem vínculo com estoque</option>
                  {materials.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} · saldo {item.stockQuantity} {item.unit}
                    </option>
                  ))}
                </select>
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
                <label className="text-xs font-bold text-neutral-600">Custo do Filamento (R$/kg)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={filamentCostPerKg}
                  onChange={e => setFilamentCostPerKg(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600">Filamento Usado (g)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={filamentUsedG}
                  onChange={e => setFilamentUsedG(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm"
                />
                <p className="text-[10px] text-neutral-400">Valor do slicer (Cura, PrusaSlicer, etc.)</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600">Tempo de Impressão (horas)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={printTimeH}
                  onChange={e => setPrintTimeH(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600">Taxa de Falha / Buffer (%)</label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  step="1"
                  value={failureRatePct}
                  onChange={e => setFailureRatePct(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm"
                />
                <p className="text-[10px] text-neutral-400">
                  Ex: 5% = 5% extra de material e tempo para cobrir falhas.
                </p>
              </div>
            </div>

            {printTimeH > 0 && (
              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-neutral-500" />
                <span className="text-sm font-bold text-neutral-700">
                  {printTimeH}h impressão · {filamentUsedG}g de {filamentType}
                </span>
              </div>
            )}

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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  {[
                    { label: 'Tarifa Energia (R$/kWh)', val: electricityRate, set: setElectricityRate },
                    { label: 'Valor Hora Operador (R$)', val: hourlyRate, set: setHourlyRate },
                    {
                      label: 'Margem de Lucro (% do preço)',
                      val: profitMarginPct,
                      set: (v: number) => setProfitMarginPct(clampMargin(v)),
                    },
                    { label: 'Pós-processamento (h)', val: postProcessHours, set: setPostProcessHours },
                    { label: 'Embalagem (R$)', val: packagingCost, set: setPackagingCost },
                    { label: 'Outros custos (R$)', val: extrasCost, set: setExtrasCost },
                  ].map(f => (
                    <div key={f.label} className="space-y-1">
                      <label className="text-xs font-bold text-neutral-600">{f.label}</label>
                      <input
                        type="number"
                        step="0.01"
                        value={f.val}
                        onChange={e => f.set(Number(e.target.value))}
                        className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600">Canal de venda</label>
                <select
                  value={channelId}
                  onChange={e => handleChannelChange(e.target.value)}
                  className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl outline-none text-sm"
                >
                  {PRINT_CHANNELS.map(channel => (
                    <option key={channel.id} value={channel.id}>
                      {channel.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600">Comissão + pagamento (%)</label>
                <input
                  type="number"
                  min="0"
                  max="95"
                  step="0.1"
                  value={fees.commissionPercent + fees.paymentPercent}
                  onChange={e =>
                    setFees(current => ({
                      ...current,
                      commissionPercent: Math.min(95, Math.max(0, Number(e.target.value))),
                      paymentPercent: 0,
                    }))
                  }
                  className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl outline-none text-sm"
                />
              </div>
            </div>
            {materialId && (
              <label className="flex items-center gap-2 text-xs font-bold text-neutral-600">
                <input type="checkbox" checked={deductStock} onChange={e => setDeductStock(e.target.checked)} /> Baixar
                o material do estoque ao salvar
              </label>
            )}

            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm resize-none"
              placeholder="Observações…"
            />
          </div>

          {result && (
            <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm space-y-4">
              <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-2">
                <DollarSign className="w-3.5 h-3.5" /> Preço de Venda
              </h2>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-bold text-sm">R$</span>
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
              <button
                type="button"
                onClick={handleSaveJob}
                disabled={savingJob || !jobName || printTimeH <= 0}
                className="w-full flex items-center justify-center gap-2 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all disabled:opacity-40"
              >
                {savingJob ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar Trabalho
              </button>
            </div>
          )}
        </div>

        {/* Result panel */}
        <div>
          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm space-y-4 sticky top-4">
            <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-2">
              <Calculator className="w-3.5 h-3.5" /> Resultado
            </h2>
            {!result ? (
              <div className="py-12 text-center text-neutral-400 text-sm italic">
                Preencha os parâmetros para calcular.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-4 bg-neutral-50 rounded-xl space-y-2">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Composição / peça</p>
                  {[
                    { label: '⚡ Energia', val: result.energyCost },
                    { label: '🧵 Filamento', val: result.filamentCost },
                    { label: '🔩 Desgaste hotend', val: result.hotendWear },
                    { label: '🛏 Desgaste mesa', val: result.bedWear },
                    { label: '⚙️ Depreciação máquina', val: result.machineWear },
                    { label: '🔧 Manutenção', val: result.maintenance },
                    { label: '👤 Mão de obra', val: result.laborCost },
                    { label: '📦 Embalagem', val: result.packagingCost },
                    { label: '➕ Outros custos', val: result.extrasCost },
                    { label: '🏷️ Taxas do canal', val: result.channelCost },
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

                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                  <p className="text-[10px] font-bold text-emerald-600 uppercase">
                    Sugerido ({profitMarginPct}% do preço)
                  </p>
                  {result.invalidMargin && (
                    <p className="text-[11px] font-bold text-red-600">
                      Margem + taxas do canal passam de 95%: não existe preço que dê esse lucro. Reduza a margem ou as
                      taxas.
                    </p>
                  )}
                  <p className="text-2xl font-black text-emerald-700">
                    {formatCurrency(result.suggestedUnit)}
                    <span className="text-sm font-medium">/peça</span>
                  </p>
                  {quantity > 1 && (
                    <p className="text-sm text-emerald-600 font-bold mt-0.5">
                      {formatCurrency(result.suggestedBatch)} total ({quantity} peças)
                    </p>
                  )}
                </div>

                {manualPrice != null && manualPrice > 0 && (
                  <div
                    className={`p-4 rounded-xl border space-y-2 ${result.profit >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-red-50 border-red-100'}`}
                  >
                    <div className="flex items-center justify-between">
                      <p className={`text-2xl font-black ${result.profit >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                        {formatCurrency(manualPrice)}
                      </p>
                      {result.profit >= 0 ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-500" />
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[10px] text-neutral-400 uppercase font-bold">Lucro</p>
                        <p className={`font-black text-sm ${result.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {formatCurrency(result.profit)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-neutral-400 uppercase font-bold">Margem</p>
                        <p className={`font-black text-sm ${result.margin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {result.margin.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                    {result.profit < 0 && (
                      <div className="flex items-start gap-2 p-2 bg-red-100 rounded-lg">
                        <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                        <p className="text-xs text-red-700 font-medium">
                          Prejuízo de {formatCurrency(Math.abs(result.profit))}/peça. Mínimo:{' '}
                          {formatCurrency(result.totalCostUnit)}.
                        </p>
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
        {loadingJobs ? (
          <div className="animate-pulse h-24 bg-neutral-100 rounded-xl" />
        ) : jobs.length === 0 ? (
          <p className="py-10 text-center text-neutral-400 italic text-sm">Nenhum trabalho salvo.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100">
                  {['Trabalho', 'Impressora', 'Filamento', 'Qtd', 'Preço', ''].map(h => (
                    <th key={h} className="text-left py-2 pr-4 text-[10px] font-black text-neutral-400 uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.map(job => (
                  <tr key={job.id} className="border-b border-neutral-50 hover:bg-neutral-50 transition-colors">
                    <td className="py-3 pr-4 font-bold text-neutral-900">{job.name}</td>
                    <td className="py-3 pr-4 text-neutral-500 text-xs">{job.printerName || job.printerId}</td>
                    <td className="py-3 pr-4 text-neutral-500">{job.filamentType}</td>
                    <td className="py-3 pr-4 text-right">{job.quantity}</td>
                    <td className="py-3 pr-4 font-bold text-right">
                      {job.manualPrice ? formatCurrency(job.manualPrice) : '—'}
                    </td>
                    <td className="py-3 text-right">
                      {(isAdmin || user?.role === 'GERENTE') && (
                        <button
                          onClick={() => handleDeleteJob(job.id)}
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

      <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 flex gap-4">
        <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
          <Info className="w-4 h-4 text-blue-600" />
        </div>
        <div>
          <p className="font-bold text-blue-900 text-sm mb-1">Sobre os cálculos</p>
          <p className="text-blue-700 text-xs leading-relaxed">
            Os dados de filamento usado e tempo de impressão devem vir do slicer (Cura, PrusaSlicer, Bambu Studio). A
            taxa de falha adiciona um buffer automático sobre todos os custos. Cadastre novas impressoras para calcular
            por máquina.
          </p>
        </div>
      </div>

      {/* Printer form modal */}
      {showPrinterForm && (
        <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-8 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold">{editingPrinter ? 'Editar Impressora' : 'Nova Impressora'}</h3>
              <button
                onClick={() => {
                  setShowPrinterForm(false);
                  setEditingPrinter(null);
                }}
                className="p-2 hover:bg-neutral-100 rounded-full"
              >
                <X className="w-5 h-5 text-neutral-400" />
              </button>
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
                { label: 'Custo de Aquisição (R$)', key: 'acquisitionCost', type: 'number' },
                { label: 'Vida Útil da Impressora (horas)', key: 'lifetimeHours', type: 'number' },
                { label: 'Manutenção Geral (R$/h)', key: 'maintenanceCostPerH', type: 'number' },
              ].map(f => (
                <div key={f.key} className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700">{f.label}</label>
                  <input
                    type={f.type}
                    required={f.key === 'label'}
                    min={f.type === 'number' ? 0 : undefined}
                    value={(newPrinter as any)[f.key] ?? ''}
                    onChange={e =>
                      setNewPrinter(p => ({
                        ...p,
                        [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm"
                  />
                </div>
              ))}
              <button
                type="submit"
                disabled={savingPrinter}
                className="w-full py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingPrinter ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {editingPrinter ? 'Atualizar' : 'Cadastrar'}
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
