import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useAccessStore } from '../store';

type PairingLink = { code: string; environmentId: string };

function takePairingLink(): PairingLink | null {
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

const link = takePairingLink();

export function usePairingFlow(
  submit: (link: PairingLink) => Promise<unknown>,
) {
  const navigate = useNavigate();
  useEffect(() => {
    if (!link || !useAccessStore.getState().beginPairing()) return;
    void (async () => {
      try {
        await submit(link);
        await navigate({ to: '/', replace: true });
      } catch {
        return;
      }
    })();
  }, [navigate, submit]);
  return link ? null : 'That link carried no pairing code.';
}
