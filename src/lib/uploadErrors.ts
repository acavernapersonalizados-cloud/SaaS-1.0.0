/**
 * uploadErrors.ts — mensagens em português para falhas ao enviar imagem (aprovado em 28/10/2026).
 * Antes aparecia o texto técnico do Firebase ("User does not have permission… (storage/unauthorized)").
 * Também tenta de novo uma vez, com o login renovado, quando o Storage nega por permissão: em 27/10/2026 uma conta
 * com acesso à loja foi negada e, minutos depois, enviou normalmente (login guardado desatualizado).
 */

/** Limite das regras do Storage (storage.rules: isImageUpload). */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export type UploadKind = 'product' | 'logo';

const codeOf = (err: unknown) => (err as { code?: string } | null)?.code ?? '';

/** Mensagem para mostrar à pessoa, com a causa e o que fazer. */
export function uploadErrorMessage(err: unknown, kind: UploadKind): string {
  switch (codeOf(err)) {
    case 'storage/unauthorized':
      return kind === 'logo'
        ? 'Sem permissão para enviar o logo: só o administrador envia, e a imagem precisa ter até 5 MB.'
        : 'Sua conta não tem permissão para enviar imagens nesta loja. Confira em Usuários se a loja está ligada à ' +
            'sua conta (ou peça ao administrador). Se você acabou de entrar ou de confirmar o e-mail, saia e entre de novo.';
    case 'storage/unauthenticated':
      return 'Sua sessão expirou. Entre de novo para enviar a imagem.';
    case 'storage/retry-limit-exceeded':
    case 'storage/canceled':
      return 'A conexão caiu durante o envio. Confira a internet e tente de novo.';
    case 'storage/quota-exceeded':
      return 'O espaço de imagens do Firebase acabou. Avise o administrador.';
  }
  // Erros do próprio app (formato, tamanho) já vêm em português.
  if (err instanceof Error && !codeOf(err) && err.message) return err.message;
  return 'Não foi possível enviar a imagem. Tente de novo.';
}

/** Envia; se o Storage negar por permissão, renova o login e tenta mais uma vez. */
export async function withFreshLoginRetry<T>(upload: () => Promise<T>, refreshLogin: () => Promise<unknown>) {
  try {
    return await upload();
  } catch (err) {
    if (codeOf(err) !== 'storage/unauthorized') throw err;
    await refreshLogin();
    return upload();
  }
}

/** Logo (enviado sem comprimir): o problema do arquivo antes de enviar, ou null. */
export function logoFileProblem(file: { type: string; size: number }): string | null {
  if (!file.type.startsWith('image/')) return 'O logo precisa ser uma imagem (PNG, JPG, WEBP ou SVG).';
  if (file.size > MAX_IMAGE_BYTES) return 'O logo passou de 5 MB. Diminua a imagem e tente de novo.';
  return null;
}
