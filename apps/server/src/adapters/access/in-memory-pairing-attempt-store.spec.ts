import { describe, expect, it } from 'vitest';
import { InMemoryPairingAttemptStore } from './in-memory-pairing-attempt-store.ts';

describe('InMemoryPairingAttemptStore', () => {
  it('reads no attempts before any are saved', () => {
    expect(new InMemoryPairingAttemptStore().read()).toEqual({
      shared: undefined,
      peers: new Map(),
    });
  });

  it('reads back the attempts saved last, replacing the earlier ones', () => {
    const store = new InMemoryPairingAttemptStore();
    store.save({
      shared: { tokens: 4, at: '2026-09-24T10:00:00.000Z' },
      peers: new Map([
        ['192.168.1.10', { tokens: 1, at: '2026-09-24T10:00:00.000Z' }],
      ]),
    });
    const latest = {
      shared: { tokens: 3, at: '2026-09-24T10:01:00.000Z' },
      peers: new Map([
        ['192.168.1.20', { tokens: 0, at: '2026-09-24T10:01:00.000Z' }],
      ]),
    };
    store.save(latest);
    expect(store.read()).toEqual(latest);
  });
});
