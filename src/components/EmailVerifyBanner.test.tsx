// @vitest-environment jsdom
// Estacionamento item 5: o botão "Confirmar meu e-mail" aparece só para quem não confirmou e envia o link.
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';

const { authState, sendMock } = vi.hoisted(() => ({
  authState: { firebaseUser: null as null | Record<string, unknown> },
  sendMock: vi.fn(async () => {}),
}));
vi.mock('firebase/auth', () => ({ sendEmailVerification: sendMock }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => authState }));

import { EmailVerifyBanner } from './EmailVerifyBanner';

afterEach(() => {
  cleanup();
  sendMock.mockClear();
});

describe('EmailVerifyBanner', () => {
  it('não aparece para e-mail confirmado nem quando o estado é desconhecido', () => {
    authState.firebaseUser = { email: 'a@teste.local', emailVerified: true };
    expect(render(<EmailVerifyBanner />).container.textContent).toBe('');
    cleanup();
    authState.firebaseUser = { email: 'a@teste.local' };
    expect(render(<EmailVerifyBanner />).container.textContent).toBe('');
  });

  it('envia o link e some depois de confirmado', async () => {
    const user: Record<string, unknown> = { email: 'a@teste.local', emailVerified: false };
    user.reload = vi.fn(async () => {
      user.emailVerified = true;
    });
    user.getIdToken = vi.fn(async () => 'token');
    authState.firebaseUser = user;
    const view = render(<EmailVerifyBanner />);
    await act(async () => fireEvent.click(view.getByText('Confirmar meu e-mail')));
    expect(sendMock).toHaveBeenCalledWith(user);
    expect(view.container.textContent).toContain('a@teste.local');
    await act(async () => fireEvent.click(view.getByText('Já confirmei')));
    expect(view.container.textContent).toBe('');
    expect(user.getIdToken).toHaveBeenCalledWith(true);
  });
});
