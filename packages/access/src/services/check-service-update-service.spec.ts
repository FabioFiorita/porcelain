import { describe, expect, it } from 'vitest';
import {
  ServiceNotManagedError,
  ServiceUpdateNotOfferedError,
  ServiceUpdateRunningError,
  UntrustedDeviceError,
} from '@porcelain/access/errors';
import type { ServiceUpdateState } from '@porcelain/access/models';
import { CheckServiceUpdateService } from './check-service-update-service.ts';

const offered: ServiceUpdateState = {
  managed: true,
  version: '1.0.0',
  latest: '1.1.0',
  available: true,
  running: false,
  last: undefined,
};
const check =
  (state: ServiceUpdateState, version = '1.1.0', canUpdate = true) =>
  () =>
    new CheckServiceUpdateService().execute({
      authority: { canUpdate },
      state,
      target: { version },
    });

describe('CheckServiceUpdateService', () => {
  it('lets the offered update start', () => {
    expect(check(offered)).not.toThrow();
  });

  it('names each refusal by its own error', () => {
    expect(check({ ...offered, managed: false })).toThrow(
      ServiceNotManagedError,
    );
    expect(check({ ...offered, running: true })).toThrow(
      ServiceUpdateRunningError,
    );
    expect(check(offered, '2.0.0')).toThrow(ServiceUpdateNotOfferedError);
    expect(check(offered, '1.1.0', false)).toThrow(UntrustedDeviceError);
  });
});
