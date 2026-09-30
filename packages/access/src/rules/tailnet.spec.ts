import { describe, expect, it } from 'vitest';
import type { RouteState } from '@porcelain/access/models';
import { tailnetNeedsCheck, tailnetShownWhileChecking } from './tailnet.ts';

const on: RouteState = { kind: 'on', urls: ['https://laptop.tail0000.ts.net'] };

describe('tailnetNeedsCheck', () => {
  it.each<[RouteState]>([
    [{ kind: 'off' }],
    [{ kind: 'starting' }],
    [{ kind: 'failed', reason: 'address-in-use' }],
    [{ kind: 'failed', reason: 'unreachable' }],
    [{ kind: 'failed', reason: 'other-server' }],
  ])(
    'asks the Tailscale name again from %j, so the tailnet recovers once Tailscale is up or the forward is set up',
    (state) => {
      expect(tailnetNeedsCheck(state)).toBe(true);
    },
  );

  it('keeps an answered tailnet until its settings change or the owner checks again', () => {
    expect(tailnetNeedsCheck(on)).toBe(false);
  });
});

describe('tailnetShownWhileChecking', () => {
  it.each<[RouteState]>([
    [on],
    [{ kind: 'failed', reason: 'unreachable' }],
    [{ kind: 'failed', reason: 'other-server' }],
  ])('keeps showing %j while the name is asked again', (state) => {
    expect(tailnetShownWhileChecking(state)).toEqual(state);
  });

  it.each<[RouteState]>([
    [{ kind: 'off' }],
    [{ kind: 'failed', reason: 'address-unavailable' }],
  ])('shows starting from %j, since nothing was answered yet', (state) => {
    expect(tailnetShownWhileChecking(state)).toEqual({ kind: 'starting' });
  });
});
