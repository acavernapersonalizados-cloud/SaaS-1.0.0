// Calculadora de Sublimação (Etapa 8D-1): cadastro das máquinas da loja. Sem custo nem preço (8D-2).
import React, { useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useStore } from '../contexts/StoreContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  DEFAULT_SUBLIMATION_MACHINES,
  formatSublimationTime,
  rowsForEquipment,
  SUBLIMATION_TIPS,
  SublimationEquipment,
  SublimationHead,
  SublimationMachine,
  SublimationMachineData,
} from '../lib/sublimation';
import { AlertCircle, CheckCircle2, Edit2, Flame, Loader2, Plus, Settings, Thermometer, Trash2, X } from 'lucide-react';

const EQUIPMENTS: SublimationEquipment[] = [
  'Prensa plana',
  'Prensa de canecas e copos',
  'Prensa de canetas',
  'Prensa de pratos',
  'Prensa 3D',
];

const emptyMachine = (): SublimationMachineData => ({
  label: '',
  voltage: 220,
  note: '',
  heads: [{ id: 'principal', name: 'Principal', powerW: 0, equipment: 'Prensa plana' }],
});

export function SublimationCalculator() {
  const { activeStore } = useStore();
  const { user, isAdmin } = useAuth();
  const { addToast } = useToast();
  const canManage = isAdmin || user?.role === 'GERENTE';

  // ── Máquinas ─────────────────────────────────────────────────────────────────
  const [machines, setMachines] = useState<SublimationMachine[]>([]);
  const [machinesLoading, setMachinesLoading] = useState(true);
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SublimationMachine | null>(null);
  const [draft, setDraft] = useState<SublimationMachineData>(emptyMachine());
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  // ── Parâmetros (item 4): parte da máquina + produto → temperatura, tempo e pressão (editáveis, não gravados) ──
  const [headId, setHeadId] = useState('');
  const [product, setProduct] = useState('');
  const [tempC, setTempC] = useState<number | ''>('');
  const [timeS, setTimeS] = useState<number | ''>('');
  const [pressure, setPressure] = useState('');

  useEffect(() => {
    if (!activeStore) {
      setMachinesLoading(false);
      return;
    }
    // Sem orderBy no banco (dispensa índice composto novo): ordena aqui pelo nome.
    return onSnapshot(
      query(collection(db, 'sublimationMachines'), where('storeId', '==', activeStore.id)),
      snap => {
        const list = snap.docs
          .map(d => ({ ...(d.data() as SublimationMachineData), id: d.id, storeId: activeStore.id }))
          .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
        setMachines(list);
        setSelectedMachineId(current => (list.some(m => m.id === current) ? current : (list[0]?.id ?? '')));
        setMachinesLoading(false);
      },
      err => {
        handleFirestoreError(err, OperationType.LIST, 'sublimationMachines');
        setMachinesLoading(false);
      },
    );
  }, [activeStore]);

  const selectedMachine = machines.find(m => m.id === selectedMachineId) ?? null;
  const selectedHead = selectedMachine?.heads.find(h => h.id === headId) ?? selectedMachine?.heads[0] ?? null;
  const productRows = rowsForEquipment(selectedHead?.equipment ?? null);

  // Trocou de máquina ou de parte: volta a parte para a primeira e limpa o produto e os valores.
  useEffect(() => {
    setHeadId(current =>
      selectedMachine?.heads.some(h => h.id === current) ? current : (selectedMachine?.heads[0]?.id ?? ''),
    );
  }, [selectedMachine]);
  useEffect(() => {
    setProduct('');
    setTempC('');
    setTimeS('');
    setPressure('');
  }, [selectedMachineId, headId]);

  const chooseProduct = (name: string) => {
    setProduct(name);
    const r = productRows.find(row => row.product === name);
    setTempC(r ? r.tempC : '');
    setTimeS(r ? r.timeS : '');
    setPressure(r?.pressure ?? '');
  };

  const openForm = (machine: SublimationMachine | null) => {
    setEditing(machine);
    setDraft(
      machine
        ? { label: machine.label, voltage: machine.voltage, note: machine.note ?? '', heads: machine.heads }
        : emptyMachine(),
    );
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
  };

  const updateHead = (index: number, patch: Partial<SublimationHead>) =>
    setDraft(d => ({ ...d, heads: d.heads.map((h, i) => (i === index ? { ...h, ...patch } : h)) }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStore || !draft.label.trim() || draft.heads.length === 0) return;
    setSaving(true);
    const data = {
      label: draft.label.trim(),
      voltage: Number(draft.voltage) || 220,
      note: draft.note?.trim() || '',
      heads: draft.heads.map((h, i) => ({
        id: h.id || `parte-${i + 1}`,
        name: h.name.trim() || `Parte ${i + 1}`,
        powerW: Math.max(0, Number(h.powerW) || 0),
        equipment: h.equipment ?? null,
      })),
      storeId: activeStore.id,
    };
    try {
      if (editing) {
        await setDoc(doc(db, 'sublimationMachines', editing.id), {
          ...data,
          createdAt: (editing as SublimationMachine & { createdAt?: string }).createdAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        addToast('Máquina atualizada!', 'success');
      } else {
        await addDoc(collection(db, 'sublimationMachines'), { ...data, createdAt: new Date().toISOString() });
        addToast('Máquina cadastrada!', 'success');
      }
      closeForm();
    } catch (err) {
      handleFirestoreError(
        err,
        editing ? OperationType.UPDATE : OperationType.CREATE,
        editing ? `sublimationMachines/${editing.id}` : 'sublimationMachines',
      );
    }
    setSaving(false);
  };

  const handleDelete = async (machine: SublimationMachine) => {
    if (!window.confirm(`Excluir a máquina "${machine.label}"?`)) return;
    try {
      await deleteDoc(doc(db, 'sublimationMachines', machine.id));
      addToast('Máquina excluída.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `sublimationMachines/${machine.id}`);
    }
  };

  /** As 4 máquinas do tabela-sublimacao.md, só quando a loja ainda não tem nenhuma (o usuário clica). */
  const handleSeedDefaults = async () => {
    if (!activeStore || machines.length > 0) return;
    setSeeding(true);
    try {
      for (const m of DEFAULT_SUBLIMATION_MACHINES) {
        await addDoc(collection(db, 'sublimationMachines'), {
          ...m,
          storeId: activeStore.id,
          createdAt: new Date().toISOString(),
        });
      }
      addToast('As 4 máquinas da tabela foram cadastradas.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'sublimationMachines');
    }
    setSeeding(false);
  };

  if (!activeStore)
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center">
          <Flame className="w-8 h-8 text-neutral-400" />
        </div>
        <h2 className="text-xl font-bold text-neutral-900">Selecione uma loja</h2>
      </div>
    );

  return (
    <div className="space-y-8 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-neutral-400 mb-1">
            <Flame className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-widest">Calculadora</span>
          </div>
          <h1 className="text-3xl font-black text-neutral-900">Sublimação</h1>
        </div>
        {canManage && (
          <button
            onClick={() => openForm(null)}
            className="flex items-center gap-2 px-4 py-2.5 bg-neutral-100 text-neutral-900 rounded-xl hover:bg-neutral-200 transition-all text-sm font-bold"
          >
            <Plus className="w-4 h-4" /> Nova Máquina
          </button>
        )}
      </header>

      {/* Máquinas */}
      <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm space-y-3">
        <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-2">
          <Settings className="w-3.5 h-3.5" /> Máquina
        </h2>
        {machinesLoading ? (
          <div className="animate-pulse h-24 bg-neutral-100 rounded-xl" />
        ) : machines.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-neutral-500">
              Nenhuma máquina de sublimação cadastrada.
              {canManage ? '' : ' Administradores e gerentes podem cadastrar.'}
            </p>
            {canManage && (
              <button
                onClick={handleSeedDefaults}
                disabled={seeding}
                className="flex items-center gap-2 px-4 py-2.5 bg-neutral-900 text-white rounded-xl hover:bg-black transition-all text-sm font-bold disabled:opacity-50"
              >
                {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Cadastrar as 4 máquinas da tabela
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {machines.map(m => (
              <div
                key={m.id}
                className={`relative p-4 rounded-2xl border-2 cursor-pointer transition-all ${selectedMachineId === m.id ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-100 hover:border-neutral-300'}`}
                onClick={() => setSelectedMachineId(m.id)}
              >
                <div className="flex items-start justify-between gap-3 mb-1">
                  <p className="font-bold text-sm text-neutral-900 leading-tight">{m.label}</p>
                  {selectedMachineId === m.id && <CheckCircle2 className="w-4 h-4 text-neutral-900 flex-shrink-0" />}
                </div>
                <p className="text-xs text-neutral-400">
                  {m.voltage} V{m.note ? ` · ${m.note}` : ''}
                </p>
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {m.heads.map(h => (
                    <span
                      key={h.id}
                      className="text-[10px] bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-full font-bold"
                    >
                      {m.heads.length > 1 ? `${h.name} ` : ''}
                      {h.powerW} W
                    </span>
                  ))}
                </div>
                {canManage && (
                  <div
                    className="flex items-center gap-2 mt-3 pt-3 border-t border-neutral-100"
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      title="Editar máquina"
                      aria-label={`Editar ${m.label}`}
                      onClick={() => openForm(m)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Editar
                    </button>
                    <button
                      type="button"
                      title="Excluir máquina"
                      aria-label={`Excluir ${m.label}`}
                      onClick={() => handleDelete(m)}
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

      {/* Parâmetros: temperatura, tempo e pressão da tabela */}
      {selectedMachine && selectedHead && (
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm space-y-4">
          <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-2">
            <Thermometer className="w-3.5 h-3.5" /> Parâmetros da prensa
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {selectedMachine.heads.length > 1 && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-700">Parte da máquina</label>
                <select
                  value={selectedHead.id}
                  onChange={e => setHeadId(e.target.value)}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:ring-2 focus:ring-neutral-900"
                >
                  {selectedMachine.heads.map(h => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.powerW} W)
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-700">Produto</label>
              {productRows.length > 0 ? (
                <select
                  value={product}
                  onChange={e => chooseProduct(e.target.value)}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:ring-2 focus:ring-neutral-900"
                >
                  <option value="">Selecione o produto</option>
                  {productRows.map(r => (
                    <option key={r.product} value={r.product}>
                      {r.product}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="px-4 py-3 bg-amber-50 border border-amber-100 text-amber-800 rounded-xl text-sm font-medium">
                  Sem referência na tabela; use os valores do fabricante.
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-700">Temperatura (°C)</label>
              <input
                type="number"
                min={0}
                value={tempC}
                onChange={e => setTempC(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-700">Tempo (s)</label>
              <input
                type="number"
                min={0}
                value={timeS}
                onChange={e => setTimeS(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:ring-2 focus:ring-neutral-900"
              />
              {timeS !== '' && timeS >= 180 && (
                <p className="text-[10px] text-neutral-400 font-bold">= {formatSublimationTime(timeS)}</p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-700">Pressão</label>
              <input
                type="text"
                value={pressure}
                onChange={e => setPressure(e.target.value)}
                placeholder={product && !pressure ? 'não indicada' : ''}
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </div>
          </div>

          <div className="p-3 bg-neutral-50 rounded-xl text-xs text-neutral-500 space-y-1">
            <p className="flex items-center gap-1.5 font-bold text-neutral-700">
              <AlertCircle className="w-3.5 h-3.5" /> Tabela sugestiva: varia conforme o material; faça um teste antes
              de produzir. Os valores aqui não são gravados.
            </p>
            {SUBLIMATION_TIPS.map(tip => (
              <p key={tip}>• {tip}</p>
            ))}
          </div>
        </div>
      )}

      {/* Janela de cadastro/edição */}
      {showForm && (
        <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-8 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-neutral-900">{editing ? 'Editar Máquina' : 'Nova Máquina'}</h3>
              <button onClick={closeForm} className="p-2 hover:bg-neutral-100 rounded-full">
                <X className="w-5 h-5 text-neutral-400" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-700">Nome da Máquina</label>
                <input
                  type="text"
                  required
                  value={draft.label}
                  onChange={e => setDraft(d => ({ ...d, label: e.target.value }))}
                  placeholder="Ex: Prensa plana 38 × 38 cm"
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700">Tensão (V)</label>
                  <input
                    type="number"
                    min={0}
                    value={draft.voltage || ''}
                    onChange={e => setDraft(d => ({ ...d, voltage: Number(e.target.value) }))}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700">Observação</label>
                  <input
                    type="text"
                    value={draft.note ?? ''}
                    onChange={e => setDraft(d => ({ ...d, note: e.target.value }))}
                    placeholder="Ex: 0–250 °C"
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-700">
                  Partes que aquecem (a 4 em 1 tem uma por acessório)
                </label>
                {draft.heads.map((h, i) => (
                  <div key={i} className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 space-y-2">
                    <div className="grid grid-cols-[1fr_6rem_auto] gap-2 items-center">
                      <input
                        type="text"
                        aria-label="Nome da parte"
                        value={h.name}
                        onChange={e => updateHead(i, { name: e.target.value })}
                        placeholder="Ex: Caneca 11 oz"
                        className="px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-neutral-900"
                      />
                      <input
                        type="number"
                        min={0}
                        aria-label="Potência (W)"
                        value={h.powerW || ''}
                        onChange={e => updateHead(i, { powerW: Number(e.target.value) })}
                        placeholder="W"
                        className="px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-neutral-900"
                      />
                      <button
                        type="button"
                        title="Remover parte"
                        disabled={draft.heads.length === 1}
                        onClick={() => setDraft(d => ({ ...d, heads: d.heads.filter((_, j) => j !== i) }))}
                        className="p-2 text-neutral-400 hover:text-red-500 disabled:opacity-30"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <select
                      aria-label="Linhas da tabela"
                      value={h.equipment ?? ''}
                      onChange={e =>
                        updateHead(i, { equipment: (e.target.value || null) as SublimationEquipment | null })
                      }
                      className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-neutral-900"
                    >
                      <option value="">Sem referência na tabela (valores do fabricante)</option>
                      {EQUIPMENTS.map(eq => (
                        <option key={eq} value={eq}>
                          Tabela: {eq}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setDraft(d => ({
                      ...d,
                      heads: [
                        ...d.heads,
                        { id: `parte-${Date.now()}`, name: '', powerW: 0, equipment: 'Prensa plana' },
                      ],
                    }))
                  }
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar parte
                </button>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all disabled:opacity-50"
              >
                {saving ? 'Salvando...' : editing ? 'Atualizar Máquina' : 'Cadastrar Máquina'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
