// Caracterização (Etapa 4, A6): grava o texto EXATO enviado à IA por cada função.
// A IA é simulada; nenhuma chamada real é feita. Se o texto mudar, o snapshot quebra.
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const sent: string[] = [];
// Quando preenchido, a IA simulada falha com esta mensagem (para testar o motivo resumido).
let failWith: string | null = null;
// Estacionamento item 3: a IA passa pelo Firebase AI Logic (firebase/ai) com App Check.
vi.mock('firebase/ai', () => ({
  getAI: () => ({}),
  GoogleAIBackend: class {},
  getGenerativeModel: () => ({
    generateContent: async (prompt: string) => {
      sent.push(prompt);
      if (failWith) throw new Error(failWith);
      return { response: { text: () => 'resposta simulada' } };
    },
  }),
}));
vi.mock('firebase/app-check', () => ({ initializeAppCheck: () => ({}), ReCaptchaEnterpriseProvider: class {} }));
// Fora do emulador (no emulador a IA fica desligada).
vi.mock('../firebase', () => ({ firebaseApp: {}, USE_EMULATOR: false }));

let gemini: typeof import('./gemini');
beforeAll(async () => {
  gemini = await import('./gemini');
});
beforeEach(() => {
  sent.length = 0;
});

const lastPrompt = () => sent[sent.length - 1];

describe('Textos enviados à IA (não podem mudar)', () => {
  it('analyzePriceHealth', async () => {
    expect(await gemini.analyzePriceHealth('TESTE Chaveiro', 7.5, 15, 50)).toBe('resposta simulada');
    expect(lastPrompt()).toMatchSnapshot();
  });
  it('suggestIdealMargin', async () => {
    await gemini.suggestIdealMargin('Presentes', 15);
    expect(lastPrompt()).toMatchSnapshot();
  });
  it('analyzeManualPrice (lucro e prejuízo)', async () => {
    await gemini.analyzeManualPrice('TESTE Chaveiro', 7.5, 12, 'Presentes');
    expect(lastPrompt()).toMatchSnapshot();
    await gemini.analyzeManualPrice('TESTE Chaveiro', 7.5, 7, 'Presentes');
    expect(lastPrompt()).toMatchSnapshot();
  });
  it('analyzeLaserPrice', async () => {
    await gemini.analyzeLaserPrice('Porta-chaves MDF', 17.5436814, 15, 'TESTE Laser', 'MDF 3mm');
    expect(lastPrompt()).toMatchSnapshot();
  });
  it('rewriteDescription', async () => {
    await gemini.rewriteDescription({ quantity: 10, productName: 'TESTE Chaveiro', clientName: 'TESTE Cliente' });
    expect(lastPrompt()).toMatchSnapshot();
  });
  it('analyzePapelariaPrice (com e sem preço)', async () => {
    await gemini.analyzePapelariaPrice('TESTE Convite', 11, 15);
    expect(lastPrompt()).toMatchSnapshot();
    await gemini.analyzePapelariaPrice('TESTE Convite', 11, 0);
    expect(lastPrompt()).toMatchSnapshot();
  });
  it('analyzeCestaPrice', async () => {
    await gemini.analyzeCestaPrice('TESTE Café da manhã', 71.5, 127.11);
    expect(lastPrompt()).toMatchSnapshot();
  });
});

// 26/10/2026: o modelo fica numa constante única, e a tela mostra o motivo resumido quando a IA falha.
describe('Modelo único e motivo da falha', () => {
  it('todas as funções usam o mesmo modelo (constante AI_MODEL)', () => {
    expect(gemini.AI_MODEL).toBe('gemini-3.8-flash');
  });
  it.each([
    [
      'models/gemini-2.5-flash is no longer available to new users. Please update your code',
      'IA indisponível: o modelo de IA (gemini-3.8-flash) não está disponível para este projeto.',
    ],
    [
      'Grounding with Google Search is not available on the free tier',
      'IA indisponível: a busca com fontes do Google não está liberada no nível gratuito (exige cobrança ativa no projeto).',
    ],
    [
      '[403] PERMISSION_DENIED: App Check token is invalid',
      'IA indisponível: acesso à IA negado (App Check ou permissão do projeto).',
    ],
    ['[429] RESOURCE_EXHAUSTED: quota exceeded', 'IA indisponível: limite de uso da IA atingido; tente mais tarde.'],
  ])('erro "%s" → mensagem com o motivo', async (error, message) => {
    failWith = error;
    try {
      expect(await gemini.analyzeCestaPrice('TESTE', 10, 20)).toBeNull();
      expect(gemini.aiUnavailableMessage()).toBe(message);
    } finally {
      failWith = null;
    }
  });
});
