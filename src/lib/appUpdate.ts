/**
 * appUpdate.ts — "existe uma versão nova publicada" (Etapa 7.1).
 * Quando o service worker acha uma versão nova, esta aba passa a ser considerada desatualizada:
 * a tela bloqueia gravações (UpdateGate) até a pessoa atualizar.
 */

type Listener = () => void;

let applyUpdate: (() => void) | null = null;
const listeners = new Set<Listener>();

/** Chamado pelo service worker (main.tsx) quando há versão nova; recebe a função que atualiza. */
export function setUpdateAvailable(apply: () => void) {
  applyUpdate = apply;
  listeners.forEach(listener => listener());
}

/** true depois que uma versão nova foi publicada e esta aba ainda não atualizou. */
export const isAppOutdated = () => applyUpdate !== null;

/** Troca para a versão nova (recarrega a página). */
export const applyAppUpdate = () => applyUpdate?.();

/** Para componentes acompanharem o estado (useSyncExternalStore). */
export function subscribeAppUpdate(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
