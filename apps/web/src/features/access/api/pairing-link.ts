import type { PairingCode } from './pairing-port';

export function takePairingCode(): PairingCode | null {
  if (typeof window === 'undefined') return null;
  const fragment = window.location.hash.replace(/^#/, '');
  if (fragment === '') return null;
  const values = new URLSearchParams(fragment);
  const code = values.get('c');
  const environmentId = values.get('e');
  window.history.replaceState(
    window.history.state,
    '',
    `${window.location.pathname}${window.location.search}`,
  );
  if (!code || !environmentId) return null;
  return { code, environmentId };
}

let taken = takePairingCode();

export function pairingCode(): PairingCode | null {
  const code = taken;
  taken = null;
  return code;
}
