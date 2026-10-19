// Etapa 7.1, itens 2 e 2b — erros do banco mostrados na tela, em português.
import { describe, expect, it } from 'vitest';
import { friendlyFirestoreMessage } from './firestoreErrors';
import { catalogSyncFailureMessage } from './catalog';

describe('friendlyFirestoreMessage', () => {
  it('permissão negada (pelo código ou pela mensagem)', () => {
    expect(friendlyFirestoreMessage({ code: 'permission-denied', message: 'x' })).toBe(
      'Acesso negado. Você não tem permissão para esta ação.',
    );
    expect(friendlyFirestoreMessage(new Error('Missing or insufficient permissions.'))).toBe(
      'Acesso negado. Você não tem permissão para esta ação.',
    );
  });
  it('sem conexão', () => {
    expect(friendlyFirestoreMessage({ code: 'unavailable', message: 'x' })).toBe('Sem conexão com o servidor.');
  });
  it('outros erros mostram a mensagem original; vazio vira "Erro desconhecido."', () => {
    expect(friendlyFirestoreMessage(new Error('Algo falhou'))).toBe('Algo falhou');
    expect(friendlyFirestoreMessage(undefined)).toBe('Erro desconhecido.');
  });
});

describe('catalogSyncFailureMessage', () => {
  it('nenhuma falha: sem aviso', () => {
    expect(catalogSyncFailureMessage([])).toBeNull();
  });
  it('um aviso só, com a quantidade e o motivo da primeira falha', () => {
    expect(catalogSyncFailureMessage([{ code: 'permission-denied' }])).toBe(
      'Não foi possível atualizar o preço do catálogo de 1 produto: Acesso negado. Você não tem permissão para esta ação.',
    );
    expect(catalogSyncFailureMessage([new Error('Sem rede'), new Error('Sem rede')])).toBe(
      'Não foi possível atualizar o preço do catálogo de 2 produtos: Sem rede',
    );
  });
});
