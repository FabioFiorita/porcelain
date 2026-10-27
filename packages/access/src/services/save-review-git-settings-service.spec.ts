import { DeviceStore, ReviewGitSettingsStore } from '@porcelain/access/ports';
import type {
  ReviewGitSettings,
  SaveReviewGitSettingsInput,
  StoredDevice,
} from '@porcelain/access/models';
import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { InMemoryDeviceStore } from '../../spec/fakes/in-memory-device-store.ts';
import { InMemoryReviewGitSettingsStore } from '../../spec/fakes/in-memory-review-git-settings-store.ts';
import { SaveReviewGitSettingsService } from './save-review-git-settings-service.ts';

const imported: ReviewGitSettings = {
  pullStrategy: 'merge',
  collapseSpecs: false,
  archiveDeleteWorktree: true,
  archiveDeleteLocalBranch: true,
  archiveDeleteRemoteBranch: true,
};

function device(id: string, extra: Partial<StoredDevice> = {}): StoredDevice {
  return {
    id,
    label: `Device ${id}`,
    platform: 'iOS',
    createdAt: '2026-10-20T10:00:00.000Z',
    lastSeenAt: '2026-10-25T09:00:00.000Z',
    route: 'lan',
    secretHash: `hash-${id}`,
    ...extra,
  };
}

function setup(...paired: StoredDevice[]) {
  const devices = new InMemoryDeviceStore();
  paired.forEach((entry) => devices.add(entry));
  const settings = new InMemoryReviewGitSettingsStore();
  const service = Effect.runSync(
    SaveReviewGitSettingsService.pipe(
      Effect.provide(SaveReviewGitSettingsService.layer),
      Effect.provideService(DeviceStore, devices),
      Effect.provideService(ReviewGitSettingsStore, settings),
    ),
  );
  return {
    settings,
    save: (input: SaveReviewGitSettingsInput) =>
      Effect.runSync(service.execute(input)),
    refusal: (input: SaveReviewGitSettingsInput) =>
      Effect.runSync(Effect.flip(service.execute(input)))._tag,
  };
}

const owner = { viewer: { kind: 'owner' as const }, local: false };
const from = (deviceId: string, local = false) => ({
  viewer: { kind: 'device' as const, deviceId },
  local,
});

describe('SaveReviewGitSettingsService', () => {
  it('configures the computer with the first imported settings as revision 1', () => {
    const { save, settings } = setup();
    expect(
      save({ ...owner, save: { kind: 'initialize', settings: imported } }),
    ).toEqual({ kind: 'configured', revision: 1, settings: imported });
    expect(Effect.runSync(settings.read())).toEqual({
      kind: 'configured',
      revision: 1,
      settings: imported,
    });
  });

  it('keeps the first import when a second device imports its own settings later', () => {
    const { save } = setup();
    save({ ...owner, save: { kind: 'initialize', settings: imported } });
    expect(
      save({
        ...owner,
        save: {
          kind: 'initialize',
          settings: { ...imported, pullStrategy: 'rebase' },
        },
      }),
    ).toEqual({ kind: 'configured', revision: 1, settings: imported });
  });

  it('keeps both changes when two devices change different settings', () => {
    const { save } = setup(
      device('phone', { trusted: true }),
      device('tablet', { trusted: true }),
    );
    save({ ...owner, save: { kind: 'initialize', settings: imported } });
    save({
      ...from('phone'),
      save: { kind: 'change', change: { pullStrategy: 'rebase' } },
    });
    expect(
      save({
        ...from('tablet'),
        save: { kind: 'change', change: { archiveDeleteRemoteBranch: false } },
      }),
    ).toEqual({
      kind: 'configured',
      revision: 3,
      settings: {
        ...imported,
        pullStrategy: 'rebase',
        archiveDeleteRemoteBranch: false,
      },
    });
  });

  it('keeps the last change when two devices change the same setting', () => {
    const { save } = setup();
    save({ ...owner, save: { kind: 'initialize', settings: imported } });
    save({
      ...owner,
      save: { kind: 'change', change: { collapseSpecs: true } },
    });
    expect(
      save({
        ...owner,
        save: { kind: 'change', change: { collapseSpecs: false } },
      }),
    ).toEqual({ kind: 'configured', revision: 3, settings: imported });
  });

  it('refuses to change one setting before the computer is configured', () => {
    const { refusal, settings } = setup();
    expect(
      refusal({
        ...owner,
        save: { kind: 'change', change: { collapseSpecs: true } },
      }),
    ).toBe('ReviewGitSettingsNotConfiguredError');
    expect(Effect.runSync(settings.read())).toEqual({ kind: 'unconfigured' });
  });

  it.for([
    { name: 'an untrusted device', paired: [device('phone')] },
    {
      name: 'a revoked trusted device',
      paired: [
        device('phone', {
          trusted: true,
          revokedAt: '2026-10-25T10:00:00.000Z',
        }),
      ],
    },
    { name: 'an unknown device', paired: [] },
  ])('refuses $name asking from another computer', ({ paired }) => {
    const { refusal, settings } = setup(...paired);
    expect(
      refusal({
        ...from('phone'),
        save: { kind: 'initialize', settings: imported },
      }),
    ).toBe('ReviewGitSettingsTrustRequiredError');
    expect(Effect.runSync(settings.read())).toEqual({ kind: 'unconfigured' });
  });

  it('lets an untrusted device save when it asks from this computer', () => {
    const { save } = setup(device('browser', { route: 'loopback' }));
    expect(
      save({
        ...from('browser', true),
        save: { kind: 'initialize', settings: imported },
      }),
    ).toEqual({ kind: 'configured', revision: 1, settings: imported });
  });
});
