// Etapa 7.1, item 1 — estado "existe versão nova publicada".
import { describe, expect, it, vi } from 'vitest';
import { applyAppUpdate, isAppOutdated, setUpdateAvailable, subscribeAppUpdate } from './appUpdate';

describe('appUpdate', () => {
  it('começa atualizado; ao achar versão nova, avisa quem está ouvindo e passa a "desatualizado"', () => {
    expect(isAppOutdated()).toBe(false);
    const listener = vi.fn();
    const unsubscribe = subscribeAppUpdate(listener);
    const apply = vi.fn();
    setUpdateAvailable(apply);
    expect(isAppOutdated()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    applyAppUpdate();
    expect(apply).toHaveBeenCalledTimes(1);
  });
});
