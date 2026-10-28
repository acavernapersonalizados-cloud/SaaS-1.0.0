// Mensagens em português e nova tentativa ao enviar imagem (aprovado em 28/10/2026).
import { describe, expect, it, vi } from 'vitest';
import { logoFileProblem, MAX_IMAGE_BYTES, uploadErrorMessage, withFreshLoginRetry } from './uploadErrors';

const fbError = (code: string) => Object.assign(new Error(`Firebase Storage: ... (${code})`), { code });

describe('uploadErrorMessage', () => {
  it('permissão negada: explica a causa em português (foto e logo)', () => {
    expect(uploadErrorMessage(fbError('storage/unauthorized'), 'product')).toContain('não tem permissão');
    expect(uploadErrorMessage(fbError('storage/unauthorized'), 'product')).toContain('Usuários');
    expect(uploadErrorMessage(fbError('storage/unauthorized'), 'logo')).toContain('só o administrador');
  });
  it('nunca mostra o texto técnico do Firebase', () => {
    for (const code of ['storage/unauthorized', 'storage/unknown', 'storage/canceled']) {
      expect(uploadErrorMessage(fbError(code), 'product')).not.toContain('Firebase Storage');
    }
  });
  it('erro do próprio app (formato) continua com a mensagem dele', () => {
    expect(uploadErrorMessage(new Error('Formato inválido. Use PNG, JPG, JPEG ou WEBP.'), 'product')).toBe(
      'Formato inválido. Use PNG, JPG, JPEG ou WEBP.',
    );
  });
});

describe('withFreshLoginRetry', () => {
  it('negado por permissão: renova o login e tenta mais uma vez', async () => {
    const upload = vi.fn().mockRejectedValueOnce(fbError('storage/unauthorized')).mockResolvedValueOnce('ok');
    const refresh = vi.fn(async () => 'token');
    await expect(withFreshLoginRetry(upload, refresh)).resolves.toBe('ok');
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(upload).toHaveBeenCalledTimes(2);
  });
  it('outro erro: não tenta de novo', async () => {
    const upload = vi.fn().mockRejectedValue(fbError('storage/canceled'));
    const refresh = vi.fn(async () => 'token');
    await expect(withFreshLoginRetry(upload, refresh)).rejects.toMatchObject({ code: 'storage/canceled' });
    expect(refresh).not.toHaveBeenCalled();
    expect(upload).toHaveBeenCalledTimes(1);
  });
  it('negado de novo depois de renovar: devolve o erro (só uma nova tentativa)', async () => {
    const upload = vi.fn().mockRejectedValue(fbError('storage/unauthorized'));
    await expect(withFreshLoginRetry(upload, async () => 'token')).rejects.toMatchObject({
      code: 'storage/unauthorized',
    });
    expect(upload).toHaveBeenCalledTimes(2);
  });
});

describe('logoFileProblem', () => {
  it('aceita imagem de até 5 MB; recusa o resto com o motivo', () => {
    expect(logoFileProblem({ type: 'image/png', size: MAX_IMAGE_BYTES })).toBeNull();
    expect(logoFileProblem({ type: 'image/png', size: MAX_IMAGE_BYTES + 1 })).toContain('5 MB');
    expect(logoFileProblem({ type: 'application/pdf', size: 10 })).toContain('imagem');
  });
});
