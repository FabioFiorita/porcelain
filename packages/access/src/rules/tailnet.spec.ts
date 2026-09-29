import { describe, expect, it } from 'vitest';
import type { TailnetReport } from '@porcelain/access/models';
import {
  tailnetHostname,
  tailnetReadiness,
  tailnetServedByUs,
  tailnetServeFailure,
  tailnetServePlan,
} from './tailnet.ts';

const ready: TailnetReport = {
  kind: 'status',
  running: true,
  https: true,
  dnsName: 'Laptop.tail0000.ts.net.',
  serving: { kind: 'nothing' },
};
const ours = 'http://127.0.0.1:41000';

describe('tailnetHostname', () => {
  it('reads the MagicDNS name without its trailing dot, in lower case', () => {
    expect(tailnetHostname('Laptop.Tail0000.ts.net.')).toBe(
      'laptop.tail0000.ts.net',
    );
  });

  it.each(['', 'laptop', 'lap top.tail0000.ts.net', 'laptop..ts.net'])(
    'reads no name from %j',
    (dnsName) => {
      expect(tailnetHostname(dnsName)).toBeUndefined();
    },
  );
});

describe('tailnetReadiness', () => {
  it('is ready at the MagicDNS name when Tailscale runs with HTTPS certificates', () => {
    expect(tailnetReadiness(ready)).toEqual({
      kind: 'ready',
      hostname: 'laptop.tail0000.ts.net',
      serving: { kind: 'nothing' },
    });
  });

  it.each([
    [{ kind: 'missing' } as const, 'tailscale-missing'],
    [{ kind: 'unavailable' } as const, 'tailscale-unavailable'],
    [{ ...ready, running: false }, 'tailscale-stopped'],
    [{ ...ready, dnsName: undefined }, 'tailscale-stopped'],
    [{ ...ready, https: false }, 'https-disabled'],
  ])('fails %j with %s', (report, reason) => {
    expect(tailnetReadiness(report)).toEqual({ kind: 'failed', reason });
  });

  it('names a stopped Tailscale before HTTPS, since a logged out node has no certificates either', () => {
    expect(
      tailnetReadiness({ ...ready, running: false, https: false }),
    ).toEqual({ kind: 'failed', reason: 'tailscale-stopped' });
  });
});

describe('tailnetServePlan', () => {
  it('serves when Tailscale serves nothing on the HTTPS port', () => {
    expect(tailnetServePlan({ kind: 'nothing' }, ours, undefined)).toBe(
      'serve',
    );
  });

  it('keeps serving what already points at this listener', () => {
    expect(tailnetServePlan({ kind: 'proxy', target: ours }, ours, ours)).toBe(
      'keep',
    );
  });

  it('replaces what Porcelain served before at a listener that is gone', () => {
    expect(
      tailnetServePlan(
        { kind: 'proxy', target: 'http://127.0.0.1:39000' },
        ours,
        'http://127.0.0.1:39000',
      ),
    ).toBe('serve');
  });

  it('leaves alone what someone else serves on the HTTPS port', () => {
    expect(
      tailnetServePlan(
        { kind: 'proxy', target: 'http://127.0.0.1:3000' },
        ours,
        'http://127.0.0.1:39000',
      ),
    ).toBe('taken');
    expect(tailnetServePlan({ kind: 'other' }, ours, undefined)).toBe('taken');
  });
});

describe('tailnetServedByUs', () => {
  it('is Porcelain’s when the HTTPS port proxies to the target it set', () => {
    expect(
      tailnetServedByUs(
        { ...ready, serving: { kind: 'proxy', target: ours } },
        ours,
      ),
    ).toBe(true);
  });

  it.each([
    [
      {
        ...ready,
        serving: { kind: 'proxy' as const, target: 'http://127.0.0.1:3000' },
      },
      ours,
    ],
    [
      { ...ready, serving: { kind: 'proxy' as const, target: ours } },
      undefined,
    ],
    [{ kind: 'missing' as const }, ours],
  ])('is not Porcelain’s for %j after setting %j', (report, previous) => {
    expect(tailnetServedByUs(report, previous)).toBe(false);
  });
});

describe('tailnetServeFailure', () => {
  it('names a refusal to change Serve and any other failure, and nothing for success', () => {
    expect(tailnetServeFailure({ kind: 'done' })).toBeUndefined();
    expect(tailnetServeFailure({ kind: 'denied' })).toBe('serve-denied');
    expect(tailnetServeFailure({ kind: 'failed' })).toBe('serve-failed');
  });
});
