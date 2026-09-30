import { describe, expect, it } from 'vitest';
import { tailnetNeedsCheck } from './tailnet.ts';

describe('tailnetNeedsCheck', () => {
  it.each([
    [{ kind: 'off' } as const],
    [{ kind: 'starting' } as const],
    [{ kind: 'failed', reason: 'address-in-use' } as const],
    [{ kind: 'failed', reason: 'address-unavailable' } as const],
  ])(
    'asks the Tailscale name again from %j, once its listener binds',
    (state) => {
      expect(tailnetNeedsCheck(state)).toBe(true);
    },
  );

  it.each([
    [{ kind: 'on' as const, urls: ['https://laptop.tail0000.ts.net'] }],
    [{ kind: 'failed', reason: 'unreachable' } as const],
    [{ kind: 'failed', reason: 'other-server' } as const],
  ])(
    'keeps %j until its settings change or the owner checks again',
    (state) => {
      expect(tailnetNeedsCheck(state)).toBe(false);
    },
  );
});
