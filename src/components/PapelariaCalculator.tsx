import React, { useState, useEffect } from 'react';
import {
  collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, where
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { PapelariaJob, PapelariaMaterialItem } from '../types';
import { formatCurrency } from '../lib/utils';
import { useStore } from '../contexts/StoreContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { analyzePapelariaPrice } from '../services/gemini';
import {
  FileText, Calculator, Sparkles, Trash2, X, Loader2, Clock,
  DollarSign, AlertCircle, CheckCircle2, Layers, Save, Info
} from 'lucide-react';

export function PapelariaCalculator() {
  const { activeStore } = useStore();
  const { user, isAdmin } = useAuth();
  const { addToast } = useToast();

  const [jobName, setJobName] = useState('');
  const [printQuantity, setPrintQuantity] = useState(1);
  const [materials, setMaterials] = useState<PapelariaMaterialItem[]>([]);
  const [newMatName, setNewMatName] = useState('');
  const [newMatCost, setNewMatCost] = useState(0);
  const [newMatQty, setNewMatQty] = useState(1);
  const [laminationCost, setLaminationCost] = useState(0);
  const [bindingCost, setBindingCost] = useState(0);
  const [assemblyTimeMin, setAssemblyTimeMin] = useState(0);
  const [finishingTimeMin, setFinishingTimeMin] = useState(0);
  const [packagingTimeMin, setPackagingTimeMin] = useState(0);
  const [hourlyRate, setHourlyRate] = useState(25);
  const [profitMarginPct, setProfitMarginPct] = useState(60);
  const [quantity, setQuantity] = useState(1);
  const [manualPrice, setManualPrice] = useState<number | null>(null);
  const [notes, setNotes] = useState('');

  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState('');

  const [jobs, setJobs] = useState<PapelariaJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [savingJob, setSavingJob] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeStore) { setLoadingJobs(false); return; }
    const unsubJ = onSnapshot(
      query(collection(db, 'papelariaJobs'), where('storeId', '==', activeStore.id), orderBy('createdAt', 'desc')),
      snap => { setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() } as PapelariaJob))); setLoadingJobs(false); },
      err => { handleFirestoreError(err, OperationType.LIST, 'papelariaJobs'); setLoadingJobs(false); }
    );
    return () => unsubJ();
  }, [activeStore]);

  const materialsCost = materials.reduce((acc, m) => acc + m.unitCost * m.quantity, 0);
  const totalTimeMin = assemblyTimeMin + finishingTimeMin + packagingTimeMin;

  const calc = () => {
    if (totalTimeMin <= 0 && materialsCost <= 0) return null;
    const laborCost = (hourlyRate / 60) * totalTimeMin;
    const totalCostBatch = materialsCost + laminationCost + bindingCost + laborCost;
    const totalCostUnit = totalCostBatch / Math.max(quantity, 1);
    const suggestedUnit = totalCostUnit * (1 + profitMarginPct / 100);
    const suggestedBatch = suggestedUnit * quantity;
    const priceRef = manualPrice ?? suggestedUnit;
    const profit = priceRef - totalCostUnit;
    const margin = priceRef > 0 ? (profit / priceRef) * 100 : 0;
    return { materialsCost, laminationCost, bindingCost, laborCost, totalCostUnit, totalCostBatch, suggestedUnit, suggestedBatch, profit, margin };
  };
  const result = calc();

  const addMaterial = () => {
    if (!newMatName) return;
    setMaterials(prev => [...prev, { id: Date.now().toString(), name: newMatName, unitCost: newMatCost, quantity: newMatQty }]);
    setNewMatName(''); setNewMatCost(0); setNewMatQty(1);
  };
  const removeMaterial = (id: string) => setMaterials(prev => prev.filter(m => m.id !== id));

  const handleAnalyzeAI = async () => {
    if (!result || !jobName) return;
    const price = manualPrice ?? result.suggestedUnit;
    setAiLoading(true);
    try {
      const analysis = await analyzePapelariaPrice(jobName, result.totalCostUnit, price);
      setAiAnalysis(analysis || '');
    } catch { setAiAnalysis('Erro ao analisar. Verifique sua conexao.'); }
    setAiLoading(false);
  };

  const handleSaveJob = async () => {
    if (!activeStore || !jobName || (totalTimeMin <= 0 && materialsCost <= 0)) {
      addToast('Preencha nome, materiais e/ou tempos de producao.', 'error'); return;
    }
    setSavingJob(true);
    try {
      await addDoc(collection(db, 'papelariaJobs'), {
        storeId: activeStore.id,
        name: jobName,
        printQuantity, materials,
        laminationCost, bindingCost,
        assemblyTimeMin, finishingTimeMin, packagingTimeMin, hourlyRate,
        quantity, manualPrice: manualPrice ?? null, notes,
        createdAt: new Date().toISOString(),
      });
      addToast('Trabalho salvo!', 'success');
      setJobName(''); setMaterials([]); setAiAnalysis(''); setManualPrice(null); setNotes('');
      setLaminationCost(0); setBindingCost(0); setAssemblyTimeMin(0); setFinishingTimeMin(0); setPackagingTimeMin(0);
    } catch (err) { handleFirestoreError(err, OperationType.CREATE, 'papelariaJobs'); }
    setSavingJob(false);
  };

  const handleDeleteJob = async (id: string) => {
    setDeletingId(id);
    try { await deleteDoc(doc(db, 'papelariaJobs', id)); addToast('Trabalho excluido.', 'success'); }
    catch (err) { handleFirestoreError(err, OperationType.DELETE, `papelariaJobs/${id}`); }
    setDeletingId(null);
  };

  if (!activeStore) return (
    <div className="flex flex-col items-center justify-center h-96 space-y-4">
      <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center"><FileText className="w-8 h-8 text-neutral-400"/></div>
      <h2 className="text-xl font-bold text-neutral-900">Selecione uma loja</h2>
    </div>
  );

  return (
    <div className="space-y-8 pb-20">
      <header>
        <div className="flex items-center gap-2 text-neutral-400 mb-1"><FileText className="w-4 h-4"/><span className="text-xs font-bold uppercase tracking-widest">Calculadora</span></div>
        <h1 className="text-3xl font-black text-neutral-900">Papelaria Personalizada</h1>
        <p className="text-neutral-500 mt-1">Convites, cadernos, agendas, kits e trabalhos graficos.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm space-y-4">
            <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-2"><Layers className="w-3.5 h-3.5"/> Detalhes do Trabalho</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-bold text-neutral-600">Nome do Trabalho</label>
                <input type="text" value={jobName} onChange={e => setJobName(e.target.value)}
                  placeholder="Ex: Convite casamento 15x21cm"
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm"/>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600">Quantidade de folhas/pecas impressas</label>
                <input type="number" min="1" value={printQuantity} onChange={e => setPrintQuantity(Math.max(1, Number(e.target.value)))}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm"/>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600">Quantidade final (kits/conjuntos)</label>
                <input type="number" min="1" value={quantity} onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm"/>
              </div>
            </div>

            <div className="space-y-2 border-t border-neutral-100 pt-4">
              <p className="text-xs font-bold text-neutral-700 uppercase tracking-wider">Materiais (papel, adesivo, cartao, acetato, wire-o)</p>
              {materials.map(m => (
                <div key={m.id} className="flex items-center gap-2 p-2 bg-neutral-50 rounded-xl text-xs">
                  <span className="flex-1 font-bold">{m.name}</span>
                  <span className="text-neutral-500">{formatCurrency(m.unitCost)} x {m.quantity} = {formatCurrency(m.unitCost * m.quantity)}</span>
                  <button type="button" onClick={() => removeMaterial(m.id)} className="p-1 text-red-400 hover:text-red-600"><X className="w-3 h-3"/></button>
                </div>
              ))}
              <div className="grid grid-cols-4 gap-2">
                <input type="text" placeholder="Material" value={newMatName} onChange={e => setNewMatName(e.target.value)}
                  className="col-span-2 px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs outline-none"/>
                <input type="number" placeholder="Custo un." value={newMatCost || ''} onChange={e => setNewMatCost(Number(e.target.value))}
                  className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs outline-none"/>
                <div className="flex gap-1">
                  <input type="number" placeholder="Qtd" value={newMatQty || ''} onChange={e => setNewMatQty(Number(e.target.value))}
                    className="flex-1 px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs outline-none"/>
                  <button type="button" onClick={addMaterial} className="px-2 py-2 bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 text-xs font-bold">+</button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-neutral-100 pt-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600">Laminacao (BOPP, Hot Stamping) - R$</label>
                <input type="number" min="0" step="0.01" value={laminationCost || ''} onChange={e => setLaminationCost(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm" placeholder="0,00"/>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600">Encadernacao (Wire-o, Espiral, Elastico) - R$</label>
                <input type="number" min="0" step="0.01" value={bindingCost || ''} onChange={e => setBindingCost(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm" placeholder="0,00"/>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600">Tempo de Montagem (min)</label>
                <input type="number" min="0" value={assemblyTimeMin || ''} onChange={e => setAssemblyTimeMin(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm"/>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600">Tempo de Acabamento (min)</label>
                <input type="number" min="0" value={finishingTimeMin || ''} onChange={e => setFinishingTimeMin(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm"/>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600">Tempo de Embalagem (min)</label>
                <input type="number" min="0" value={packagingTimeMin || ''} onChange={e => setPackagingTimeMin(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm"/>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600">Valor Hora Trabalho (R$)</label>
                <input type="number" min="0" step="0.5" value={hourlyRate} onChange={e => setHourlyRate(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm"/>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600">Margem de Lucro (%)</label>
                <input type="number" min="0" max="500" value={profitMarginPct} onChange={e => setProfitMarginPct(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm"/>
              </div>
            </div>

            {totalTimeMin > 0 && (
              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-neutral-500"/>
                <span className="text-sm font-bold text-neutral-700">
                  {Math.floor(totalTimeMin / 60) > 0 ? `${Math.floor(totalTimeMin / 60)}h ` : ''}{(totalTimeMin % 60).toFixed(0)}min de producao
                </span>
              </div>
            )}

            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm resize-none" placeholder="Observacoes (opcional)"/>
          </div>

          {result && (
            <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm space-y-4">
              <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-2"><DollarSign className="w-3.5 h-3.5"/> Preco de Venda</h2>
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600">Seu preco por unidade (opcional)</label>
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
                  <div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-violet-600"/><span className="text-xs font-bold text-violet-700 uppercase">Analise IA</span></div>
                  <p className="text-sm text-violet-900 leading-relaxed whitespace-pre-line">{aiAnalysis}</p>
                </div>
              )}
              <button type="button" onClick={handleSaveJob} disabled={savingJob || !jobName}
                className="w-full flex items-center justify-center gap-2 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all disabled:opacity-40">
                {savingJob ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
                Salvar Trabalho
              </button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm space-y-4 sticky top-4">
            <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-2"><Calculator className="w-3.5 h-3.5"/> Resultado</h2>
            {!result ? (
              <div className="py-12 text-center text-neutral-400 text-sm italic">Adicione materiais ou tempos para calcular.</div>
            ) : (
              <div className="space-y-3">
                <div className="p-4 bg-neutral-50 rounded-xl space-y-2">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Composicao / unidade</p>
                  {[
                    { label: 'Materiais', val: result.materialsCost / Math.max(quantity, 1) },
                    { label: 'Laminacao', val: result.laminationCost / Math.max(quantity, 1) },
                    { label: 'Encadernacao', val: result.bindingCost / Math.max(quantity, 1) },
                    { label: 'Mao de obra', val: result.laborCost / Math.max(quantity, 1) },
                  ].map(r => (
                    <div key={r.label} className="flex justify-between text-sm">
                      <span className="text-neutral-600">{r.label}</span>
                      <span className="font-bold">{formatCurrency(r.val)}</span>
                    </div>
                  ))}
                  <div className="border-t border-neutral-200 pt-1.5 flex justify-between font-black text-sm">
                    <span>Custo / unidade</span><span>{formatCurrency(result.totalCostUnit)}</span>
                  </div>
                </div>

                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Sugerido ({profitMarginPct}%)</p>
                  <p className="text-2xl font-black text-emerald-700">{formatCurrency(result.suggestedUnit)}<span className="text-sm font-medium">/un</span></p>
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
                        <p className="text-xs text-red-700 font-medium">Prejuizo de {formatCurrency(Math.abs(result.profit))}/un. Minimo: {formatCurrency(result.totalCostUnit)}.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-neutral-900">Trabalhos Salvos</h2>
        {loadingJobs ? <div className="animate-pulse h-24 bg-neutral-100 rounded-xl"/> : jobs.length === 0 ? (
          <p className="py-10 text-center text-neutral-400 italic text-sm">Nenhum trabalho salvo.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-neutral-100">
                {['Trabalho', 'Qtd', 'Preco', ''].map(h => (
                  <th key={h} className="text-left py-2 pr-4 text-[10px] font-black text-neutral-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {jobs.map(job => (
                  <tr key={job.id} className="border-b border-neutral-50 hover:bg-neutral-50 transition-colors">
                    <td className="py-3 pr-4 font-bold text-neutral-900">{job.name}</td>
                    <td className="py-3 pr-4 text-right text-neutral-600">{job.quantity}</td>
                    <td className="py-3 pr-4 font-bold text-neutral-900 text-right">{job.manualPrice ? formatCurrency(job.manualPrice) : '-'}</td>
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

      <div className="bg-amber-50 p-5 rounded-2xl border border-amber-100 flex gap-4">
        <div className="w-9 h-9 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0"><Info className="w-4 h-4 text-amber-600"/></div>
        <div>
          <p className="font-bold text-amber-900 text-sm mb-1">Sobre os calculos</p>
          <p className="text-amber-700 text-xs leading-relaxed">O custo total soma materiais (papel, adesivo, cartao etc.), acabamentos (laminacao, encadernacao) e mao de obra (montagem + acabamento + embalagem). O custo e dividido pela quantidade final de kits/conjuntos para chegar ao valor unitario.</p>
        </div>
      </div>
    </div>
  );
}
