import { describe, expect, it } from 'vitest';
import {
  type ServiceUpdate,
  serviceUpdateOutcome,
  serviceUpdateProgress,
} from './service-update.ts';

const idle: ServiceUpdate = {
  managed: true,
  version: '1.0.0',
  latest: '1.1.0',
  available: true,
  running: false,
  last: undefined,
  canUpdate: true,
};
const during = (stage: 'downloading' | 'installing' | 'restarting') => ({
  ...idle,
  running: true,
  last: { from: '1.0.0', target: '1.1.0', stage, reason: undefined },
});

describe('serviceUpdateProgress', () => {
  it('names the stage of a running update', () => {
    expect(serviceUpdateProgress(during('downloading'), false)).toBe(
      'Downloading 1.1.0…',
    );
    expect(serviceUpdateProgress(during('installing'), false)).toBe(
      'Installing 1.1.0…',
    );
  });

  it('says the server is restarting while it restarts or cannot be reached', () => {
    const restarting =
      'Restarting Porcelain on 1.1.0. This page reconnects when it is back.';
    expect(serviceUpdateProgress(during('restarting'), false)).toBe(restarting);
    expect(serviceUpdateProgress(during('installing'), true)).toBe(restarting);
  });

  it('shows no progress when nothing runs', () => {
    expect(serviceUpdateProgress(idle, true)).toBeNull();
  });
});

describe('serviceUpdateOutcome', () => {
  it('reports an update that reached the running version', () => {
    expect(
      serviceUpdateOutcome({
        ...idle,
        version: '1.1.0',
        available: false,
        last: {
          from: '1.0.0',
          target: '1.1.0',
          stage: 'updated',
          reason: undefined,
        },
      }),
    ).toEqual({ kind: 'updated', from: '1.0.0', target: '1.1.0' });
  });

  it('reports a failed update with its reason', () => {
    expect(
      serviceUpdateOutcome({
        ...idle,
        last: {
          from: '1.0.0',
          target: '1.1.0',
          stage: 'failed',
          reason: 'npm could not reach the registry',
        },
      }),
    ).toEqual({
      kind: 'failed',
      target: '1.1.0',
      reason: 'npm could not reach the registry',
    });
  });

  it('reports nothing while an update runs or before any update', () => {
    expect(serviceUpdateOutcome(during('installing'))).toBeNull();
    expect(serviceUpdateOutcome(idle)).toBeNull();
  });
});
