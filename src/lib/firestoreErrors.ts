/**
 * firestoreErrors.ts — motivo de um erro do banco em português, para mostrar na tela.
 */

/** Traduz um erro do Firestore (ou qualquer erro) para uma frase curta. */
export function friendlyFirestoreMessage(error: unknown): string {
  const code = String((error as { code?: unknown } | null)?.code ?? '');
  const message =
    error instanceof Error ? error.message : String((error as { message?: unknown } | null)?.message ?? '');
  if (code === 'permission-denied' || /permission-denied|insufficient permissions/i.test(message)) {
    return 'Acesso negado. Você não tem permissão para esta ação.';
  }
  if (code === 'unavailable') return 'Sem conexão com o servidor.';
  return message || 'Erro desconhecido.';
}
