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
  margin: number
): Promise<string | null> {
  return generate(
    `Analise a saúde financeira deste produto:
    Produto: ${productName}
    Custo Total: R$ ${totalCost.toFixed(2)}
    Preço de Venda Sugerido: R$ ${unitPrice.toFixed(2)}
    Margem de Lucro: ${margin.toFixed(2)}%
    
    Dê um feedback curto e profissional sobre se o preço é sustentável para um pequeno ateliê.`
  );
}

export async function suggestIdealMargin(
  category: string,
  productionTime: number
): Promise<string | null> {
  return generate(
    `Sugira uma margem de lucro ideal para um produto da categoria "${category}" que leva ${productionTime} minutos para ser produzido em um ateliê artesanal.
    Considere o valor do trabalho manual e o mercado brasileiro. Retorne apenas a porcentagem sugerida e uma breve justificativa.`
  );
}

export async function analyzeManualPrice(
  productName: string,
  calculatedCost: number,
  manualPrice: number,
  category: string
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

Seja objetivo e use linguagem simples. Se o preço for abaixo do custo, avise com urgência.`
  );
}

export async function analyzeLaserPrice(
  jobName: string,
  totalCost: number,
  manualPrice: number,
  machine: string,
  material: string
): Promise<string | null> {
  const profit = manualPrice - totalCost;
  const margin = manualPrice > 0 ? (profit / manualPrice) * 100 : 0;

  return generate(
    `Você é um consultor especializado em corte a laser para pequenos negócios brasileiros.

Analise a precificação deste serviço de corte/gravação a laser:
- Serviço: ${jobName}
- Máquina: ${machine}
- Material: ${material}
- Custo total calculado (energia + desgaste + mão de obra): R$ ${totalCost.toFixed(2)}
- Preço cobrado: R$ ${manualPrice.toFixed(2)}
- Lucro: R$ ${profit.toFixed(2)}
- Margem: ${margin.toFixed(1)}%

Em 3 frases curtas:
1. Se o preço é viável e sustentável para o negócio
2. Como está comparado ao mercado de corte a laser no Brasil
3. Uma dica prática de precificação para este tipo de serviço`
  );
}

export async function rewriteDescription(quoteDetails: {
  quantity: number;
  productName: string;
  clientName: string;
}): Promise<string | null> {
  return generate(
    `Reescreva a descrição comercial para um orçamento de ${quoteDetails.quantity} unidades de "${quoteDetails.productName}" para o cliente ${quoteDetails.clientName}.
    O tom deve ser profissional, elegante e persuasivo, destacando a qualidade artesanal.`
  );
}

export async function analyzePapelariaPrice(
  jobName: string,
  totalCost: number,
  manualPrice: number
): Promise<string | null> {
  const profit = manualPrice - totalCost;
  const margin = manualPrice > 0 ? (profit / manualPrice) * 100 : 0;

  return generate(
    `Você é um consultor especializado em papelaria personalizada para pequenos negócios brasileiros.

Analise a precificação deste trabalho de papelaria (convites, cadernos, agendas, kits personalizados):
- Trabalho: ${jobName}
- Custo total calculado (material + impressão + acabamento + montagem): R$ ${totalCost.toFixed(2)}
- Preço cobrado: R$ ${manualPrice.toFixed(2)}
- Lucro: R$ ${profit.toFixed(2)}
- Margem: ${margin.toFixed(1)}%

Em 3 frases curtas:
1. Se o preço é viável e sustentável para o negócio
2. Como está comparado ao mercado de papelaria personalizada no Brasil
3. Uma dica prática de precificação para este tipo de trabalho`
  );
}

export async function analyzeCestaPrice(
  jobName: string,
  totalCost: number,
  manualPrice: number
): Promise<string | null> {
  const profit = manualPrice - totalCost;
  const margin = manualPrice > 0 ? (profit / manualPrice) * 100 : 0;

  return generate(
    `Você é um consultor especializado em cestas e kits personalizados para pequenos negócios brasileiros.

Analise a precificação desta cesta/kit personalizado:
- Cesta: ${jobName}
- Custo total calculado (produtos internos + embalagem + montagem): R$ ${totalCost.toFixed(2)}
- Preço cobrado: R$ ${manualPrice.toFixed(2)}
- Lucro: R$ ${profit.toFixed(2)}
- Margem: ${margin.toFixed(1)}%

Em 3 frases curtas:
1. Se o preço é viável e sustentável para o negócio
2. Como está comparado ao mercado de cestas personalizadas no Brasil
3. Uma dica prática de precificação para este tipo de produto`
  );
}
