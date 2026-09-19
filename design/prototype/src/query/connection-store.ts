import type { LiveState } from '../contracts/live';

/**
 * Whether this browser is a paired device, and whether the live channel is up.
 * `unpaired` and `revoked` come from any request's error; pairing again clears them.
 */
export type Pairing = 'paired' | 'unpaired' | 'revoked';

export function createConnectionStore() {
  let state: { pairing: Pairing; live: LiveState } = {
    pairing: 'paired',
    live: 'connected',
  };
  const listeners = new Set<() => void>();
  const set = (next: Partial<typeof state>) => {
    state = { ...state, ...next };
    for (const listener of listeners) listener();
  };
  return {
    get: () => state,
    setPairing: (pairing: Pairing) => set({ pairing }),
    setLive: (live: LiveState) => set({ live }),
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type ConnectionStore = ReturnType<typeof createConnectionStore>;
