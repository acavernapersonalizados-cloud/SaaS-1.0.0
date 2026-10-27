import React, { useState, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { CostBase, SalesChannel, WholesaleTier } from '../types';
import { formatCurrency, formatPercent } from '../lib/utils';
import { MAX_MARKUP_PERCENT, clampMarkup, markupOf, priceForMarkup, realMargin } from '../lib/pricingEngine';
import {
  CHANNEL_CHECK_DAYS,
  channelFees,
  channelsOf,
  markChannelChecked,
  staleChannelLabel,
  staleChannels,
  todayISODate,
} from '../lib/channels';
import {
  MAX_WHOLESALE_DISCOUNT_PCT,
  WHOLESALE_FLOOR_MARKUP_PCT,
  normalizeWholesaleTiers,
  wholesaleTierLabel,
  wholesaleTiersOf,
} from '../lib/wholesale';
import { electricityRateOf } from '../lib/defaults';
import {
  FEE_CHECK,
  FEE_CHECK_UNAVAILABLE_MESSAGE,
  FEE_FIELD_LABELS,
  FeeSuggestion,
  applyFeeSuggestion,
  buildFeeCheckPrompt,
  parseFeeSuggestions,
} from '../lib/feeCheck';
import { aiUnavailableMessage, checkChannelFees } from '../services/gemini';
import { useStore } from '../contexts/StoreContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Save, Info, Calculator, Loader2, AlertCircle, Plus, Trash2, Sparkles } from 'lucide-react';

export function CostBaseSettings() {
  const { activeStore } = useStore();
  const { user, isAdmin, isOperador } = useAuth();
  const { addToast } = useToast();
  const [costs, setCosts] = useState<CostBase>({
    fixedCosts: 0,
    productiveHours: 0,
    profitGoal: 0,
    hourlyRate: 0,
    storeId: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Meta de lucro como markup sobre o custo; enquanto não é salvo, vem da conversão da meta antiga.
  const [markup, setMarkup] = useState(0);
  // Tarifa de energia da loja (Etapa 7.2); enquanto não é salva, mostra a padrão (0,79).
  const [electricityRate, setElectricityRate] = useState(electricityRateOf(null));
  const round2 = (v: number) => Math.round(v * 100) / 100;
  // Tabela de canais da loja; enquanto não é salva, mostra a padrão.
  const [channels, setChannels] = useState<SalesChannel[]>(channelsOf(null));
  const setChannel = (i: number, patch: Partial<SalesChannel>) =>
    setChannels(prev => prev.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  // Etapa 9A: canais sem conferência há mais de 60 dias, e o botão "Conferi hoje", que grava na hora só a data
  // daquele canal (na tabela salva da loja; o resto do formulário continua esperando "Salvar Configurações").
  const canEdit = !(!isAdmin && user?.role === 'OPERADOR');
  const savedChannels = channelsOf(costs);
  const stale = staleChannels(savedChannels);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const markChecked = async (channelId: string) => {
    if (!activeStore) return;
    const date = todayISODate();
    const salesChannels = markChannelChecked(savedChannels, channelId, date);
    setCheckingId(channelId);
    try {
      await setDoc(doc(db, 'costBases', activeStore.id), { salesChannels, storeId: activeStore.id }, { merge: true });
      setCosts(prev => ({ ...prev, salesChannels }));
      setChannels(prev => markChannelChecked(prev, channelId, date));
      addToast('Conferência do canal registrada.', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `costBases/${activeStore.id}`);
    } finally {
      setCheckingId(null);
    }
  };

  // Etapa 9C: "Verificar taxas com IA". A IA sugere mudanças com a fonte; cada uma só entra com "Aplicar"
  // (grava na hora só aquele campo daquele canal) ou sai com "Recusar". Nada muda sem aprovação.
  const [feeCheck, setFeeCheck] = useState<{
    loading: boolean;
    done: boolean;
    unavailable: boolean;
    unreadable: boolean;
    discarded: number;
    suggestions: FeeSuggestion[];
    sources: Array<{ title: string; uri: string }>;
    searchSuggestionsHtml: string;
  } | null>(null);
  const [applyingFee, setApplyingFee] = useState<string | null>(null);
  const feeKey = (s: FeeSuggestion) => `${s.channelId}:${s.field}`;
  const runFeeCheck = async () => {
    setFeeCheck({
      loading: true,
      done: false,
      unavailable: false,
      unreadable: false,
      discarded: 0,
      suggestions: [],
      sources: [],
      searchSuggestionsHtml: '',
    });
    const response = await checkChannelFees(buildFeeCheckPrompt(savedChannels));
    if (!response) {
      setFeeCheck({
        loading: false,
        done: true,
        unavailable: true,
        unreadable: false,
        discarded: 0,
        suggestions: [],
        sources: [],
        searchSuggestionsHtml: '',
      });
      return;
    }
    const { suggestions, discarded, unreadable } = parseFeeSuggestions(response.text, savedChannels);
    setFeeCheck({
      loading: false,
      done: true,
      unavailable: false,
      unreadable,
      discarded,
      suggestions,
      sources: response.sources,
      searchSuggestionsHtml: response.searchSuggestionsHtml || '',
    });
  };
  const dropFee = (s: FeeSuggestion) =>
    setFeeCheck(prev =>
      prev ? { ...prev, suggestions: prev.suggestions.filter(x => feeKey(x) !== feeKey(s)) } : prev,
    );
  const approveFee = async (s: FeeSuggestion) => {
    if (!activeStore) return;
    const salesChannels = applyFeeSuggestion(savedChannels, s);
    setApplyingFee(feeKey(s));
    try {
      await setDoc(doc(db, 'costBases', activeStore.id), { salesChannels, storeId: activeStore.id }, { merge: true });
      setCosts(prev => ({ ...prev, salesChannels }));
      setChannels(prev => applyFeeSuggestion(prev, s));
      dropFee(s);
      addToast(`${s.channelName}: ${FEE_FIELD_LABELS[s.field]} atualizada para ${s.suggested}.`, 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `costBases/${activeStore.id}`);
    } finally {
      setApplyingFee(null);
    }
  };

  // Faixas de atacado da loja (Etapa 8C); enquanto não são salvas, mostra as padrão.
  const [tiers, setTiers] = useState<WholesaleTier[]>(wholesaleTiersOf(null));
  const setTier = (i: number, patch: Partial<WholesaleTier>) =>
    setTiers(prev => prev.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  // Rótulo da faixa ("10–29 un") pela ordem das faixas válidas; vazio enquanto a faixa é inválida.
  const tierLabel = (t: WholesaleTier) => {
    const sorted = normalizeWholesaleTiers(tiers);
    return wholesaleTierLabel(
      sorted,
      sorted.findIndex(n => n.minQty === Math.floor(Number(t.minQty) || 0)),
    );
  };

  useEffect(() => {
    if (!activeStore) {
      setLoading(false);
      return;
    }

    const fetchCosts = async () => {
      const docRef = doc(db, 'costBases', activeStore.id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as CostBase;
        setCosts(data);
        setMarkup(round2(markupOf(data)));
        setElectricityRate(electricityRateOf(data));
        setChannels(channelsOf(data));
        setTiers(wholesaleTiersOf(data));
      } else {
        setMarkup(0);
        setElectricityRate(electricityRateOf(null));
        setChannels(channelsOf(null));
        setTiers(wholesaleTiersOf(null));
        setCosts({
          fixedCosts: 0,
          productiveHours: 0,
          profitGoal: 0,
          hourlyRate: 0,
          storeId: activeStore.id,
        });
      }
      setLoading(false);
    };
    fetchCosts();
  }, [activeStore]);

  const calculateHourlyRate = (fixed: number, hours: number) => {
    if (hours === 0) return 0;
    return fixed / hours;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStore) return;
    setSaving(true);
    try {
      const hourlyRate = calculateHourlyRate(costs.fixedCosts, costs.productiveHours);
      const markupPct = clampMarkup(markup);
      // profitGoal (legado) fica com a margem equivalente, para o dado antigo não contradizer o novo.
      const profitGoal = (markupPct / (100 + markupPct)) * 100;
      const salesChannels = channels
        .filter(c => c.name.trim())
        .map(c => ({ ...c, name: c.name.trim(), note: c.note?.trim() || '', checkedAt: c.checkedAt || '' }));
      const updatedCosts = {
        ...costs,
        hourlyRate,
        markupPct,
        profitGoal,
        electricityRate: electricityRateOf({ electricityRate }),
        salesChannels,
        wholesaleTiers: normalizeWholesaleTiers(tiers),
        storeId: activeStore.id,
      };
      await setDoc(doc(db, 'costBases', activeStore.id), updatedCosts);
      setCosts(updatedCosts);
      addToast('Base de custos salva com sucesso!', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `costBases/${activeStore.id}`);
    } finally {
      setSaving(false);
    }
  };

  if (!activeStore) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center">
          <Calculator className="w-8 h-8 text-neutral-400" />
        </div>
        <h2 className="text-xl font-bold text-neutral-900">Selecione uma loja</h2>
        <p className="text-neutral-500">Você precisa selecionar uma loja para configurar a base de custos.</p>
      </div>
    );
  }

  if (loading) return <div className="animate-pulse h-96 bg-neutral-200 rounded-2xl" />;

  return (
    <div className="max-w-3xl mx-auto space-y-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
          Base de Custos — {activeStore.fantasyName || activeStore.name}
        </h1>
        <p className="text-neutral-500 mt-1">Configure os parâmetros fundamentais para sua precificação.</p>
      </header>

      <form onSubmit={handleSave} className="bg-white p-10 rounded-3xl border border-neutral-200 shadow-sm space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <label className="text-sm font-bold text-neutral-700 flex items-center gap-2">
              Custos Fixos Mensais
              <Info className="w-4 h-4 text-neutral-400" />
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-medium">R$</span>
              <input
                type="number"
                value={costs.fixedCosts !== undefined && costs.fixedCosts !== null ? costs.fixedCosts : ''}
                onChange={e => setCosts({ ...costs, fixedCosts: Number(e.target.value) })}
                className="w-full pl-12 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all outline-none font-medium"
                placeholder="0,00"
                required
              />
            </div>
            <p className="text-[10px] text-neutral-400">Aluguel, luz, internet, MEI, etc.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-neutral-700 flex items-center gap-2">
              Horas Produtivas Mensais
              <Info className="w-4 h-4 text-neutral-400" />
            </label>
            <div className="relative">
              <input
                type="number"
                value={
                  costs.productiveHours !== undefined && costs.productiveHours !== null ? costs.productiveHours : ''
                }
                onChange={e => setCosts({ ...costs, productiveHours: Number(e.target.value) })}
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all outline-none font-medium"
                placeholder="Ex: 160"
                required
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 text-xs font-medium">
                horas
              </span>
            </div>
            <p className="text-[10px] text-neutral-400">Tempo real dedicado à produção.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-neutral-700 flex items-center gap-2">
              Meta de Lucro — markup sobre o custo (%)
              <Info className="w-4 h-4 text-neutral-400" />
            </label>
            <div className="relative">
              <input
                type="number"
                min={0}
                max={MAX_MARKUP_PERCENT}
                step="0.01"
                value={markup}
                onChange={e => setMarkup(Number(e.target.value))}
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all outline-none font-medium"
                placeholder="Ex: 100"
                required
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 font-medium">%</span>
            </div>
            <p className="text-[10px] text-neutral-400">
              Quanto você acrescenta sobre o custo (0 a {MAX_MARKUP_PERCENT}%). Ex.: 100% com custo de R$ 10 dá preço de
              R$ 20 na venda direta. Nos canais com taxa, as taxas são somadas por cima e o lucro em R$ continua o
              mesmo.
            </p>
            <p className="text-xs font-bold text-emerald-700">
              Margem real na venda direta: {formatPercent(realMargin(10 * (1 + clampMarkup(markup) / 100), 10))}
            </p>
            {costs.markupPct == null && (costs.profitGoal ?? 0) > 0 && (
              <p className="text-xs font-bold text-amber-700">
                Convertido da meta antiga ({formatPercent(costs.profitGoal)}{' '}
                {costs.profitGoal >= 95 ? 'sobre o custo' : 'sobre o preço'}) sem mudar nenhum preço. Salve para gravar.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-neutral-700 flex items-center gap-2">
              Tarifa de energia (R$/kWh)
              <Info className="w-4 h-4 text-neutral-400" />
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-medium">R$</span>
              <input
                type="number"
                min={0}
                step="0.00001"
                value={electricityRate}
                onChange={e => setElectricityRate(Number(e.target.value))}
                className="w-full pl-12 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all outline-none font-medium"
                placeholder="0,79"
                required
              />
            </div>
            <p className="text-[10px] text-neutral-400">
              Da conta de luz: TU + TE com tributos (ex.: 0,39492 + 0,39401 = 0,79). Usada pelo Corte a Laser e pela
              Impressão 3D.
            </p>
            {costs.electricityRate == null && (
              <p className="text-xs font-bold text-amber-700">
                Valor padrão: confira e salve para gravar a tarifa desta loja.
              </p>
            )}
          </div>

          <div className="bg-neutral-900 p-6 rounded-2xl flex flex-col justify-center gap-2 text-white shadow-lg">
            <div className="flex items-center gap-2 text-neutral-400 text-xs font-bold uppercase tracking-wider">
              <Calculator className="w-4 h-4" />
              Valor da Hora Trabalhada
            </div>
            <span className="text-3xl font-bold">
              {formatCurrency(calculateHourlyRate(costs.fixedCosts, costs.productiveHours))}
            </span>
            <p className="text-[10px] text-neutral-500">Calculado automaticamente com base nos custos fixos.</p>
          </div>
        </div>

        <div className="space-y-3 pt-6 border-t border-neutral-100">
          <div>
            <h2 className="text-sm font-bold text-neutral-700">Canais de venda</h2>
            <p className="text-[10px] text-neutral-400">
              Taxas de cada canal, usadas nos orçamentos e nas calculadoras. A margem real mostra o que sobra do preço
              com o markup acima, depois das taxas.
              {!costs.salesChannels?.length && ' Valores padrão: confira e salve para gravar a tabela desta loja.'}
            </p>
          </div>
          {stale.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
              <p className="font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> {stale.length}{' '}
                {stale.length === 1 ? 'canal sem conferência' : 'canais sem conferência'} há mais de{' '}
                {CHANNEL_CHECK_DAYS} dias
              </p>
              <p>{stale.map(s => `${s.channel.name} (${staleChannelLabel(s)})`).join(' · ')}</p>
              <p>Confira as taxas no site de cada canal e clique em "Conferi hoje" na linha dele.</p>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-bold uppercase text-neutral-400">
                  <th className="py-2 pr-2">Canal</th>
                  <th className="py-2 pr-2">Comissão %</th>
                  <th className="py-2 pr-2">Taxa fixa R$</th>
                  <th className="py-2 pr-2">Pagamento %</th>
                  <th className="py-2 pr-2">Observação</th>
                  <th className="py-2 pr-2">Conferido em</th>
                  <th className="py-2 pr-2">Margem real</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {channels.map((c, i) => {
                  const { feePct, fixedFee } = channelFees(c);
                  const price = priceForMarkup(10, clampMarkup(markup), feePct, fixedFee);
                  return (
                    <tr key={c.id} className="border-t border-neutral-100">
                      <td className="py-1 pr-2 min-w-[8rem]">
                        <input
                          className="w-full px-2 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-neutral-900"
                          value={c.name}
                          onChange={e => setChannel(i, { name: e.target.value })}
                        />
                      </td>
                      <td className="py-1 pr-2 w-24">
                        <input
                          type="number"
                          min={0}
                          max={95}
                          step="0.01"
                          className="w-full px-2 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-neutral-900"
                          value={c.commissionPct}
                          onChange={e => setChannel(i, { commissionPct: Number(e.target.value) })}
                        />
                      </td>
                      <td className="py-1 pr-2 w-24">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          className="w-full px-2 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-neutral-900"
                          value={c.fixedFee}
                          onChange={e => setChannel(i, { fixedFee: Number(e.target.value) })}
                        />
                      </td>
                      <td className="py-1 pr-2 w-24">
                        <input
                          type="number"
                          min={0}
                          max={95}
                          step="0.01"
                          className="w-full px-2 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-neutral-900"
                          value={c.paymentPct}
                          onChange={e => setChannel(i, { paymentPct: Number(e.target.value) })}
                        />
                      </td>
                      <td className="py-1 pr-2 min-w-[8rem]">
                        <input
                          className="w-full px-2 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-neutral-900"
                          value={c.note ?? ''}
                          onChange={e => setChannel(i, { note: e.target.value })}
                        />
                      </td>
                      <td className="py-1 pr-2 w-36">
                        <input
                          type="date"
                          className="w-full px-2 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-neutral-900"
                          value={c.checkedAt ?? ''}
                          onChange={e => setChannel(i, { checkedAt: e.target.value })}
                        />
                        {canEdit && savedChannels.some(s => s.id === c.id) && (
                          <button
                            type="button"
                            onClick={() => markChecked(c.id)}
                            disabled={checkingId === c.id}
                            className="mt-1 w-full px-2 py-1 text-[11px] font-bold text-neutral-700 bg-neutral-100 rounded-lg hover:bg-neutral-200 disabled:opacity-50"
                          >
                            Conferi hoje
                          </button>
                        )}
                      </td>
                      <td className="py-1 pr-2 whitespace-nowrap text-xs font-bold text-emerald-700">
                        {price ? formatPercent(realMargin(price, 10, feePct, fixedFee)) : '—'}
                      </td>
                      <td className="py-1 text-right">
                        <button
                          type="button"
                          title="Excluir canal"
                          onClick={() => setChannels(prev => prev.filter((_, j) => j !== i))}
                          className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={() =>
              setChannels(prev => [
                ...prev,
                { id: `canal-${Date.now()}`, name: '', commissionPct: 0, fixedFee: 0, paymentPct: 0 },
              ])
            }
            className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-neutral-700 bg-neutral-100 rounded-lg hover:bg-neutral-200"
          >
            <Plus className="w-4 h-4" /> Incluir canal
          </button>

          {canEdit && (
            <div className="space-y-3 p-4 bg-neutral-50 border border-neutral-200 rounded-xl">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-neutral-500">
                  A IA pesquisa as páginas oficiais dos canais e sugere mudanças com a fonte. Nada muda sem você
                  aplicar.
                </p>
                <button
                  type="button"
                  onClick={runFeeCheck}
                  disabled={!FEE_CHECK.available || feeCheck?.loading}
                  title={FEE_CHECK.available ? undefined : FEE_CHECK_UNAVAILABLE_MESSAGE}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 disabled:opacity-50"
                >
                  {feeCheck?.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Verificar taxas com IA
                </button>
              </div>
              {!FEE_CHECK.available && (
                <p className="text-xs font-bold text-amber-700">{FEE_CHECK_UNAVAILABLE_MESSAGE}</p>
              )}
              {feeCheck?.done && (
                <div className="space-y-2 text-xs">
                  {feeCheck.unavailable && (
                    <p className="text-red-700 font-bold">{aiUnavailableMessage()} Nada foi alterado.</p>
                  )}
                  {feeCheck.unreadable && (
                    <p className="text-red-700 font-bold">
                      A IA não respondeu no formato esperado. Nada foi alterado; tente de novo.
                    </p>
                  )}
                  {!feeCheck.unavailable && !feeCheck.unreadable && feeCheck.suggestions.length === 0 && (
                    <p className="text-emerald-700 font-bold">Nenhuma mudança pendente nas taxas.</p>
                  )}
                  {feeCheck.discarded > 0 && (
                    <p className="text-amber-700">
                      {feeCheck.discarded} sugestão(ões) sem fonte ou com valor inválido foram descartadas.
                    </p>
                  )}
                  {feeCheck.suggestions.length > 0 && (
                    <p className="text-amber-700 font-bold">A IA pode errar: abra a fonte antes de aplicar.</p>
                  )}
                  {feeCheck.suggestions.map(s => (
                    <div
                      key={feeKey(s)}
                      className="flex flex-wrap items-center justify-between gap-2 p-3 bg-white border border-neutral-200 rounded-lg"
                    >
                      <div className="space-y-0.5">
                        <p className="font-bold text-neutral-900">
                          {s.channelName} · {FEE_FIELD_LABELS[s.field]}: {s.current} → {s.suggested}
                        </p>
                        {s.note && <p className="text-neutral-500">{s.note}</p>}
                        <a
                          href={s.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-700 underline break-all"
                        >
                          Fonte: {s.sourceUrl}
                        </a>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => approveFee(s)}
                          disabled={applyingFee === feeKey(s)}
                          className="px-3 py-1.5 font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Aplicar
                        </button>
                        <button
                          type="button"
                          onClick={() => dropFee(s)}
                          className="px-3 py-1.5 font-bold text-neutral-700 bg-neutral-100 rounded-lg hover:bg-neutral-200"
                        >
                          Recusar
                        </button>
                      </div>
                    </div>
                  ))}
                  {feeCheck.searchSuggestionsHtml && <GoogleSearchSuggestions html={feeCheck.searchSuggestionsHtml} />}
                  {feeCheck.sources.length > 0 && (
                    <div className="text-neutral-500">
                      <p className="font-bold">Páginas pesquisadas:</p>
                      <ul className="list-disc pl-5">
                        {feeCheck.sources.map(src => (
                          <li key={src.uri}>
                            <a href={src.uri} target="_blank" rel="noopener noreferrer" className="underline break-all">
                              {src.title || src.uri}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-3 pt-6 border-t border-neutral-100">
          <div>
            <h2 className="text-sm font-bold text-neutral-700">Desconto de atacado (por quantidade)</h2>
            <p className="text-[10px] text-neutral-400">
              Desconto sobre o preço de varejo de cada item do orçamento, pela quantidade, em qualquer canal. O preço
              nunca fica abaixo do piso: custo × {(1 + WHOLESALE_FLOOR_MARKUP_PCT / 100).toFixed(2).replace('.', ',')} +
              taxas do canal.
              {!costs.wholesaleTiers?.length && ' Valores padrão: confira e salve para gravar as faixas desta loja.'}
            </p>
          </div>
          <table className="w-full text-sm max-w-md">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase text-neutral-400">
                <th className="py-2 pr-2">A partir de (un)</th>
                <th className="py-2 pr-2">Desconto %</th>
                <th className="py-2 pr-2">Faixa</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {tiers.map((t, i) => (
                <tr key={i} className="border-t border-neutral-100">
                  <td className="py-1 pr-2 w-28">
                    <input
                      type="number"
                      min={2}
                      step={1}
                      aria-label={`Quantidade mínima da faixa ${i + 1}`}
                      className="w-full px-2 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-neutral-900"
                      value={t.minQty}
                      onChange={e => setTier(i, { minQty: Number(e.target.value) })}
                    />
                  </td>
                  <td className="py-1 pr-2 w-28">
                    <input
                      type="number"
                      min={0}
                      max={MAX_WHOLESALE_DISCOUNT_PCT}
                      step="0.5"
                      aria-label={`Desconto da faixa ${i + 1}`}
                      className="w-full px-2 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-neutral-900"
                      value={t.discountPct}
                      onChange={e => setTier(i, { discountPct: Number(e.target.value) })}
                    />
                  </td>
                  <td className="py-1 pr-2 whitespace-nowrap text-xs text-neutral-500">{tierLabel(t)}</td>
                  <td className="py-1 text-right">
                    <button
                      type="button"
                      title="Excluir faixa"
                      onClick={() => setTiers(prev => prev.filter((_, j) => j !== i))}
                      className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            onClick={() => setTiers(prev => [...prev, { minQty: 0, discountPct: 0 }])}
            className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-neutral-700 bg-neutral-100 rounded-lg hover:bg-neutral-200"
          >
            <Plus className="w-4 h-4" /> Incluir faixa
          </button>
        </div>

        <div className="pt-6 border-t border-neutral-100">
          {!isAdmin && user?.role === 'OPERADOR' ? (
            <div className="p-4 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl text-sm font-medium flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              Você não tem permissão para alterar a base de custos. Apenas visualização.
            </div>
          ) : (
            <button
              type="submit"
              disabled={saving}
              className="flex items-center justify-center gap-2 w-full md:w-auto px-8 py-3 bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 transition-all font-bold shadow-sm disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Salvar Configurações
            </button>
          )}
        </div>
      </form>

      <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 flex gap-4">
        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
          <Info className="w-5 h-5 text-blue-600" />
        </div>
        <div className="space-y-1">
          <h3 className="font-bold text-blue-900 text-sm">Por que isso é importante?</h3>
          <p className="text-blue-700 text-xs leading-relaxed">
            Saber o valor da sua hora é o primeiro passo para não ter prejuízo. Muitos artesãos esquecem de incluir o
            custo do tempo, o que acaba "comendo" o lucro real no final do mês.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Sugestões de pesquisa do Google (9C). Com a busca do Google, é obrigatório mostrá-las; a documentação do
 * Firebase AI Logic recomenda colocar o HTML pronto dentro de um shadow DOM, para não misturar com o app.
 */
function GoogleSearchSuggestions({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
    root.innerHTML = html;
  }, [html]);
  return <div ref={ref} aria-label="Sugestões de pesquisa do Google" />;
}
