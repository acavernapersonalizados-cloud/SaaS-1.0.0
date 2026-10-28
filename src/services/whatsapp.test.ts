// Estacionamento item 17 (28/10/2026): regra do 55 e mensagem do status.
import { describe, expect, it } from 'vitest';
import { generateStatusMessage, whatsappLink, whatsappNumber } from './whatsapp';

describe('whatsappNumber (regra do 55)', () => {
  it('sem o país: põe o 55', () => {
    expect(whatsappNumber('(11) 99999-8888')).toBe('5511999998888');
    expect(whatsappNumber('11 3333-4444')).toBe('551133334444');
  });
  it('já com 55 e 12 ou 13 dígitos: fica como está (não duplica)', () => {
    expect(whatsappNumber('+55 11 99999-8888')).toBe('5511999998888');
    expect(whatsappNumber('551133334444')).toBe('551133334444');
  });
  it('DDD 55 (RS) sem o país: põe o 55 na frente', () => {
    expect(whatsappNumber('(55) 99999-8888')).toBe('5555999998888');
  });
  it('vazio: vazio', () => expect(whatsappNumber('')).toBe(''));
});

describe('whatsappLink e mensagem do status', () => {
  it('link com o número e a mensagem', () => {
    expect(whatsappLink('11 99999-8888', 'Olá!')).toBe('https://wa.me/5511999998888?text=Ol%C3%A1!');
  });
  it('mensagem só nos status que avisam o cliente', () => {
    expect(generateStatusMessage('Aprovado', 'Caneca')).toContain('aprovado');
    expect(generateStatusMessage('Em produção', 'Caneca')).toContain('produção');
    expect(generateStatusMessage('Finalizado', 'Caneca')).toContain('pronto');
    expect(generateStatusMessage('Pendente', 'Caneca')).toBe('');
  });
});
