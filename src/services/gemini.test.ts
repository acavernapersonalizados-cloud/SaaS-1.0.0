// Caracterização (Etapa 4, A6): grava o texto EXATO enviado à IA por cada função.
// A IA é simulada; nenhuma chamada real é feita. Se o texto mudar, o snapshot quebra.
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const sent: string[] = [];
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = {
      generateContent: async ({ contents }: { contents: string }) => {
        sent.push(contents);
        return { text: 'resposta simulada' };
      },
    };
  },
}));

let gemini: typeof import('./gemini');
beforeAll(async () => {
  vi.stubEnv('VITE_GEMINI_API_KEY', 'chave-de-teste');
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
