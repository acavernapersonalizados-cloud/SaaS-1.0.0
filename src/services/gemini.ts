import { getAI, getGenerativeModel, GoogleAIBackend, type AI } from 'firebase/ai';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { firebaseApp, USE_EMULATOR } from '../firebase';

// ─────────────────────────────────────────────────────────────────────────────
// Estacionamento item 3 (26/10/2026): a IA passa pelo Firebase AI Logic (Gemini Developer API).
// A chave do Gemini fica só do lado do Firebase — nunca no site nem no .env do front — e o
// App Check (reCAPTCHA Enterprise) só deixa passar chamadas vindas do site num navegador de verdade.
//
// Lazy singleton — o App Check e o AI Logic só são ligados na primeira chamada de IA, para a
// abertura do app não ficar mais pesada. No emulador (npm run dev) a IA fica desligada: o projeto
// de teste "demo-*" não fala com o Google. Em qualquer falha, as funções devolvem null sem quebrar.
// ─────────────────────────────────────────────────────────────────────────────

let _ai: AI | null = null;

/**
 * MODELO DA IA — o único lugar para trocar (vale para todas as funções deste arquivo).
 * 26/10/2026: o Gemini 2.0 Flash foi desligado e o 2.5 Flash não é liberado para projetos novos; o
 * `gemini-3.8-flash` é estável e grátis no nível gratuito para texto. Atenção: no nível gratuito, a busca
 * com fontes do Google (usada só pela 9C) NÃO está disponível nos modelos 3.x — exige cobrança ativa
 * (5.000 buscas grátis por mês, depois US$ 14 a cada 1.000; ver ai.google.dev/gemini-api/docs/pricing).
 */
export const AI_MODEL = 'gemini-3.8-flash';

// Motivo resumido da última falha da IA, para a tela mostrar no lugar de um "IA indisponível" genérico.
let lastFailure = '';

function summarizeAIError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  const msg = raw.toLowerCase();
  if (msg.includes('no longer available') || msg.includes('not found') || msg.includes('404'))
    return `o modelo de IA (${AI_MODEL}) não está disponível para este projeto`;
  if (msg.includes('search') || msg.includes('grounding'))
    return 'a busca com fontes do Google não está liberada no nível gratuito (exige cobrança ativa no projeto)';
  if (msg.includes('app check') || msg.includes('appcheck') || msg.includes('permission') || msg.includes('403'))
    return 'acesso à IA negado (App Check ou permissão do projeto)';
  if (msg.includes('quota') || msg.includes('rate') || msg.includes('429') || msg.includes('resource_exhausted'))
    return 'limite de uso da IA atingido; tente mais tarde';
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('offline')) return 'sem conexão com a IA';
  return raw.slice(0, 140) || 'erro desconhecido';
}

function fail(context: string, err: unknown): null {
  lastFailure = summarizeAIError(err);
  console.warn(`[Gemini] ${context}:`, err);
  return null;
}

/** Mensagem para a tela quando a IA não respondeu: "IA indisponível: <motivo resumido>." */
export function aiUnavailableMessage(): string {
  return `IA indisponível: ${lastFailure || 'sem resposta da IA'}.`;
}

function getAIClient(): AI | null {
  if (USE_EMULATOR) {
    lastFailure = 'a IA fica desligada no emulador (npm run dev); ela só funciona no site';
    return null;
  }
  if (!_ai) {
    const siteKey = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY as string | undefined;
    if (siteKey) {
      initializeAppCheck(firebaseApp, {
        provider: new ReCaptchaEnterpriseProvider(siteKey),
        isTokenAutoRefreshEnabled: true,
      });
    }
    _ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });
  }
  return _ai;
}

// Helper interno: chama a API ou retorna null sem lançar erro (o motivo fica em aiUnavailableMessage)
async function generate(prompt: string): Promise<string | null> {
  const ai = getAIClient();
  if (!ai) return null;
  try {
    const result = await getGenerativeModel(ai, { model: AI_MODEL }).generateContent(prompt);
    const text = result.response.text();
    if (!text) lastFailure = 'a IA respondeu vazio';
    return text || null;
  } catch (err) {
    return fail('Erro na geração', err);
  }
}

// ─── Funções exportadas (interface pública inalterada) ────────────────────────

export async function analyzePriceHealth(
  productName: string,
  totalCost: number,
  unitPrice: number,
  margin: number,
): Promise<string | null> {
  return generate(
    `Analise a saúde financeira deste produto:
    Produto: ${productName}
    Custo Total: R$ ${totalCost.toFixed(2)}
    Preço de Venda Sugerido: R$ ${unitPrice.toFixed(2)}
    Margem de Lucro (sobre o preço de venda): ${margin.toFixed(2)}%
    
    Dê um feedback curto e profissional sobre se o preço é sustentável para um pequeno ateliê.`,
  );
}

export async function suggestIdealMargin(category: string, productionTime: number): Promise<string | null> {
  return generate(
    `Sugira uma margem de lucro ideal para um produto da categoria "${category}" que leva ${productionTime} minutos para ser produzido em um ateliê artesanal.
    A margem é a porcentagem do PREÇO DE VENDA que vira lucro (não um acréscimo sobre o custo), entre 0% e 90%.
    Considere o valor do trabalho manual e o mercado brasileiro. Retorne apenas a porcentagem sugerida e uma breve justificativa.`,
  );
}

export async function analyzeManualPrice(
  productName: string,
  calculatedCost: number,
  manualPrice: number,
  category: string,
): Promise<string | null> {
  const profit = manualPrice - calculatedCost;
  const margin = calculatedCost > 0 ? (profit / manualPrice) * 100 : 0;
  const markup = calculatedCost > 0 ? (profit / calculatedCost) * 100 : 0;

  return generate(
    `Você é um consultor financeiro especializado em pequenos ateliês e makers brasileiros.
  
Analise a viabilidade do preço manual definido para este produto:
- Produto: ${productName}
- Categoria: ${category}
- Custo de produção calculado: R$ ${calculatedCost.toFixed(2)}
- Preço manual definido: R$ ${manualPrice.toFixed(2)}
- Lucro bruto: R$ ${profit.toFixed(2)}
- Margem sobre venda: ${margin.toFixed(1)}%
- Markup sobre custo: ${markup.toFixed(1)}%

Responda em até 3 frases curtas e diretas:
1. Se o preço cobre os custos e é sustentável
2. Se a margem é adequada para o mercado de artesanato/personalização brasileiro
3. Uma sugestão prática (ex: se deve aumentar, manter ou se pode abaixar estrategicamente)

Seja objetivo e use linguagem simples. Se o preço for abaixo do custo, avise com urgência.`,
  );
}

// Análise de preço de um trabalho (Laser, Papelaria, Cestas): mesmo texto-base,
// mudando só a especialidade, os campos e o tipo de mercado.
interface JobPriceAnalysis {
  specialty: string;
  intro: string;
  subjectLabel: string;
  jobName: string;
  extraLines?: string[];
  costParts: string;
  totalCost: number;
  manualPrice: number;
  market: string;
  tipKind: string;
}

function analyzeJobPrice(job: JobPriceAnalysis): Promise<string | null> {
  const profit = job.manualPrice - job.totalCost;
  const margin = job.manualPrice > 0 ? (profit / job.manualPrice) * 100 : 0;
  const lines = [
    `- ${job.subjectLabel}: ${job.jobName}`,
    ...(job.extraLines ?? []),
    `- Custo total calculado (${job.costParts}): R$ ${job.totalCost.toFixed(2)}`,
    `- Preço cobrado: R$ ${job.manualPrice.toFixed(2)}`,
    `- Lucro: R$ ${profit.toFixed(2)}`,
    `- Margem: ${margin.toFixed(1)}%`,
  ];

  return generate(
    `Você é um consultor especializado em ${job.specialty} para pequenos negócios brasileiros.

${job.intro}
${lines.join('\n')}

Em 3 frases curtas:
1. Se o preço é viável e sustentável para o negócio
2. Como está comparado ao mercado de ${job.market} no Brasil
3. Uma dica prática de precificação para este tipo de ${job.tipKind}`,
  );
}

export async function analyzeLaserPrice(
  jobName: string,
  totalCost: number,
  manualPrice: number,
  machine: string,
  material: string,
): Promise<string | null> {
  return analyzeJobPrice({
    specialty: 'corte a laser',
    intro: 'Analise a precificação deste serviço de corte/gravação a laser:',
    subjectLabel: 'Serviço',
    jobName,
    extraLines: [`- Máquina: ${machine}`, `- Material: ${material}`],
    costParts: 'energia + desgaste + mão de obra',
    totalCost,
    manualPrice,
    market: 'corte a laser',
    tipKind: 'serviço',
  });
}

export async function rewriteDescription(quoteDetails: {
  quantity: number;
  productName: string;
  clientName: string;
}): Promise<string | null> {
  return generate(
    `Reescreva a descrição comercial para um orçamento de ${quoteDetails.quantity} unidades de "${quoteDetails.productName}" para o cliente ${quoteDetails.clientName}.
    O tom deve ser profissional, elegante e persuasivo, destacando a qualidade artesanal.`,
  );
}

export async function analyzePapelariaPrice(
  jobName: string,
  totalCost: number,
  manualPrice: number,
): Promise<string | null> {
  return analyzeJobPrice({
    specialty: 'papelaria personalizada',
    intro: 'Analise a precificação deste trabalho de papelaria (convites, cadernos, agendas, kits personalizados):',
    subjectLabel: 'Trabalho',
    jobName,
    costParts: 'material + impressão + acabamento + montagem',
    totalCost,
    manualPrice,
    market: 'papelaria personalizada',
    tipKind: 'trabalho',
  });
}

export async function analyzeCestaPrice(
  jobName: string,
  totalCost: number,
  manualPrice: number,
): Promise<string | null> {
  return analyzeJobPrice({
    specialty: 'cestas e kits personalizados',
    intro: 'Analise a precificação desta cesta/kit personalizado:',
    subjectLabel: 'Cesta',
    jobName,
    costParts: 'produtos internos + embalagem + montagem',
    totalCost,
    manualPrice,
    market: 'cestas personalizadas',
    tipKind: 'produto',
  });
}

// ─── Etapa 9C: verificação das taxas dos canais, com pesquisa no Google ───────

export interface FeeCheckResponse {
  /** Texto da IA (a lista em JSON pedida em lib/feeCheck.ts). */
  text: string;
  /** Páginas que a pesquisa usou (título e link). */
  sources: Array<{ title: string; uri: string }>;
  /** Sugestões de pesquisa do Google (HTML e CSS prontos), que é obrigatório mostrar quando há busca. */
  searchSuggestionsHtml: string;
}

/** Pede à IA a conferência das taxas, pesquisando na web. null sem IA ou em caso de erro. */
export async function checkChannelFees(prompt: string): Promise<FeeCheckResponse | null> {
  const ai = getAIClient();
  if (!ai) return null;
  try {
    const model = getGenerativeModel(ai, { model: AI_MODEL, tools: [{ googleSearch: {} }] });
    const { response } = await model.generateContent(prompt);
    const grounding = response.candidates?.[0]?.groundingMetadata;
    const sources = (grounding?.groundingChunks ?? [])
      .map(c => ({ title: c.web?.title ?? '', uri: c.web?.uri ?? '' }))
      .filter(s => /^https?:\/\//.test(s.uri));
    return {
      text: response.text() ?? '',
      sources,
      searchSuggestionsHtml: grounding?.searchEntryPoint?.renderedContent ?? '',
    };
  } catch (err) {
    return fail('Erro na verificação de taxas', err);
  }
}
