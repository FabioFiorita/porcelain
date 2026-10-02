import { describe, expect, it } from 'vitest';
import type { ServiceUpdateState } from '@porcelain/access/models';
import { serviceUpdateRefusal } from './service-update.ts';

const offered: ServiceUpdateState = {
  managed: true,
  version: '1.0.0',
  latest: '1.1.0',
  available: true,
  running: false,
  last: undefined,
};
const allowed = { canUpdate: true };

describe('serviceUpdateRefusal', () => {
  it('lets the installed service update to the newer version it offers, not to the one it runs', () => {
    expect(
      serviceUpdateRefusal(offered, { version: '1.1.0' }, allowed),
    ).toBeUndefined();
    expect(
      serviceUpdateRefusal(offered, { version: '1.0.0' }, allowed),
    ).toEqual({ kind: 'not-offered' });
  });

  it('refuses a caller that may not update before anything else', () => {
    expect(
      serviceUpdateRefusal(
        { ...offered, managed: false, running: true },
        { version: '2.0.0' },
        { canUpdate: false },
      ),
    ).toEqual({ kind: 'untrusted' });
  });

  it('refuses a server that does not run as the installed service', () => {
    expect(
      serviceUpdateRefusal(
        { ...offered, managed: false },
        { version: '1.1.0' },
        allowed,
      ),
    ).toEqual({ kind: 'unmanaged' });
  });

  it('refuses while another update runs', () => {
    expect(
      serviceUpdateRefusal(
        { ...offered, running: true },
        { version: '1.1.0' },
        allowed,
      ),
    ).toEqual({ kind: 'running' });
  });

  it.each([
    ['a version other than the one offered', offered, '2.0.0'],
    [
      'the running version when nothing newer exists',
      { ...offered, latest: '1.0.0', available: false },
      '1.0.0',
    ],
    [
      'any version when the newest could not be read',
      { ...offered, latest: undefined, available: false },
      '1.1.0',
    ],
  ])('refuses %s', (_, state, version) => {
    expect(serviceUpdateRefusal(state, { version }, allowed)).toEqual({
      kind: 'not-offered',
    });
  });
});
