import { describe, expect, it } from 'vitest';
import { openAppManagedUpdateRunner } from './app-managed-update-runner.ts';

describe('openAppManagedUpdateRunner', () => {
  const check = {
    now: '2026-10-01T00:00:00.000Z',
    staleBefore: '2026-09-30T23:00:00.000Z',
  };

  it('reports a server the service updater does not manage, with nothing to offer', async () => {
    expect(await openAppManagedUpdateRunner().read(check)).toEqual({
      managed: false,
      version: undefined,
      latest: undefined,
      available: false,
      running: false,
      last: undefined,
    });
  });

  it('refuses to start a service update and says the app updates its server', async () => {
    await expect(
      openAppManagedUpdateRunner().start({ version: '9.9.9' }),
    ).rejects.toThrow('the Porcelain app, which updates it with the app');
  });
});
