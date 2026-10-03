import { describe, expect, it } from 'vitest';
import type {
  PairingAttemptLimits,
  PairingAttempts,
} from '@porcelain/access/models';
import {
  refundPairingAttempt,
  takePairingAttempt,
} from './pairing-attempts.ts';

const limits: PairingAttemptLimits = {
  windowMs: 60_000,
  attemptsPerPeer: 10,
  attemptsOverall: 60,
  maxPeers: 3,
};
const start = '2026-01-01T00:00:00.000Z';
const fresh: PairingAttempts = { shared: undefined, peers: new Map() };

function takeTimes(
  count: number,
  peer: string,
  now = start,
  attempts = fresh,
): { attempts: PairingAttempts; taken: boolean[] } {
  const taken: boolean[] = [];
  let current = attempts;
  for (let index = 0; index < count; index += 1) {
    const next = takePairingAttempt(current, peer, now, limits);
    taken.push(next.taken);
    current = next.attempts;
  }
  return { attempts: current, taken };
}

describe('takePairingAttempt', () => {
  it('lets a peer make ten attempts at once and refuses the eleventh', () => {
    const { taken } = takeTimes(11, 'peer-a');
    expect(taken.slice(0, 10).every(Boolean)).toBe(true);
    expect(taken[10]).toBe(false);
  });

  it('gives an exhausted peer one attempt back each tenth of the window', () => {
    const { attempts } = takeTimes(10, 'peer-a');
    expect(
      takePairingAttempt(attempts, 'peer-a', '2026-01-01T00:00:05.999Z', limits)
        .taken,
    ).toBe(false);
    expect(
      takePairingAttempt(attempts, 'peer-a', '2026-01-01T00:00:06.000Z', limits)
        .taken,
    ).toBe(true);
  });

  it('keeps one peer exhausting its allowance from limiting another', () => {
    const { attempts } = takeTimes(11, 'peer-a');
    expect(takePairingAttempt(attempts, 'peer-b', start, limits).taken).toBe(
      true,
    );
  });

  it('refuses every peer once sixty attempts were made across them', () => {
    let attempts = fresh;
    for (let index = 0; index < 60; index += 1)
      attempts = takePairingAttempt(attempts, `peer-${index % 2}`, start, {
        ...limits,
        attemptsPerPeer: 60,
      }).attempts;
    expect(
      takePairingAttempt(attempts, 'peer-0', start, {
        ...limits,
        attemptsPerPeer: 60,
      }).taken,
    ).toBe(false);
  });

  it('refuses a new peer while as many peers as the limit were seen within the window', () => {
    let attempts = fresh;
    for (const peer of ['a', 'b', 'c'])
      attempts = takePairingAttempt(attempts, peer, start, limits).attempts;
    const refused = takePairingAttempt(attempts, 'd', start, limits);
    expect(refused.taken).toBe(false);
    expect([...refused.attempts.peers.keys()]).toEqual(['a', 'b', 'c']);
  });

  it('forgets peers idle for longer than the window to make room for a new one', () => {
    let attempts = fresh;
    for (const peer of ['a', 'b', 'c'])
      attempts = takePairingAttempt(attempts, peer, start, limits).attempts;
    const later = takePairingAttempt(
      attempts,
      'd',
      '2026-01-01T00:01:00.001Z',
      limits,
    );
    expect(later.taken).toBe(true);
    expect([...later.attempts.peers.keys()]).toEqual(['d']);
  });
});

describe('refundPairingAttempt', () => {
  it('gives a peer back the attempt a success used', () => {
    const { attempts } = takeTimes(10, 'peer-a');
    const refunded = refundPairingAttempt(attempts, 'peer-a', start, limits);
    expect(takePairingAttempt(refunded, 'peer-a', start, limits).taken).toBe(
      true,
    );
  });

  it('never raises a peer above its allowance', () => {
    const { attempts } = takeTimes(1, 'peer-a');
    const refunded = refundPairingAttempt(
      refundPairingAttempt(attempts, 'peer-a', start, limits),
      'peer-a',
      start,
      limits,
    );
    expect(takeTimes(11, 'peer-a', start, refunded).taken[10]).toBe(false);
  });
});
