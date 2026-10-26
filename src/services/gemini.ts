import { GoogleGenAI } from '@google/genai';

// ─────────────────────────────────────────────────────────────────────────────
// Lazy singleton — instanciado APENAS na primeira chamada de IA.
// Se VITE_GEMINI_API_KEY não existir: sistema funciona normalmente,
// funções de IA retornam null silenciosamente.
// ─────────────────────────────────────────────────────────────────────────────

let _client: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!apiKey) return null;
  if (!_client) _client = new GoogleGenAI({ apiKey });
  return _client;
}

const MODEL = 'gemini-2.0-flash';

// Helper interno: chama a API ou retorna null sem lançar erro
async function generate(prompt: string): Promise<string | null> {
  const client = getGeminiClient();
  if (!client) return null;
  try {
    const response = await client.models.generateContent({ model: MODEL, contents: prompt });
    return response.text ?? null;
  } catch (err) {
    console.warn('[Gemini] Erro na geração:', err);
    return null;
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
}

/** Pede à IA a conferência das taxas, pesquisando na web. null sem chave da IA ou em caso de erro. */
export async function checkChannelFees(prompt: string): Promise<FeeCheckResponse | null> {
  const client = getGeminiClient();
  if (!client) return null;
  try {
    const response = await client.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] },
    });
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    const sources = chunks
      .map(c => ({ title: c.web?.title ?? '', uri: c.web?.uri ?? '' }))
      .filter(s => /^https?:\/\//.test(s.uri));
    return { text: response.text ?? '', sources };
  } catch (err) {
    console.warn('[Gemini] Erro na verificação de taxas:', err);
    return null;
  }
}
