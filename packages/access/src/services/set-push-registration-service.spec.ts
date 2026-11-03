import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { DeviceStore } from '../ports/device-store.ts';
import { PushRegistrationStore } from '../ports/push-registration-store.ts';
import { InMemoryDeviceStore } from '../../spec/fakes/in-memory-device-store.ts';
import { InMemoryPushRegistrationStore } from '../../spec/fakes/in-memory-push-registration-store.ts';
import { SetPushRegistrationService } from './set-push-registration-service.ts';
import { ClearPushRegistrationService } from './clear-push-registration-service.ts';

function setup() {
  const store = new InMemoryPushRegistrationStore();
  const devices = new InMemoryDeviceStore();
  for (const id of ['phone', 'tablet'])
    devices.add({
      id,
      label: id,
      platform: 'iOS',
      createdAt: '2026-11-01T10:00:00.000Z',
      lastSeenAt: '2026-11-02T10:00:00.000Z',
      route: 'lan',
      secretHash: 'hash',
    });
  devices.add({
    id: 'revoked',
    label: 'Old phone',
    platform: 'iOS',
    createdAt: '2026-11-01T10:00:00.000Z',
    lastSeenAt: '2026-11-02T10:00:00.000Z',
    route: 'lan',
    secretHash: 'hash',
    revokedAt: '2026-11-02T11:00:00.000Z',
  });
  return {
    store,
    set: Effect.runSync(
      SetPushRegistrationService.pipe(
        Effect.provide(SetPushRegistrationService.layer),
        Effect.provideService(PushRegistrationStore, store),
        Effect.provideService(DeviceStore, devices),
      ),
    ),
    clear: Effect.runSync(
      ClearPushRegistrationService.pipe(
        Effect.provide(ClearPushRegistrationService.layer),
        Effect.provideService(PushRegistrationStore, store),
      ),
    ),
  };
}
const phone = { kind: 'device', deviceId: 'phone' } as const;
const token = 'ExponentPushToken[phone]';

describe('SetPushRegistrationService', () => {
  it('stores the calling device token with the kinds it asked for', async () => {
    const { store, set } = setup();
    const result = await Effect.runPromise(
      set.execute({
        viewer: phone,
        token,
        platform: 'android',
        kinds: ['agent-reply', 'review-ready'],
      }),
    );
    const registration = {
      deviceId: 'phone',
      token,
      platform: 'android',
      kinds: ['review-ready', 'agent-reply'],
    };
    expect(result).toEqual({ kind: 'registered', registration });
    expect(await Effect.runPromise(store.list())).toEqual([registration]);
  });

  it('clears the device registration when it asks for no kinds', async () => {
    const { store, set } = setup();
    await Effect.runPromise(
      set.execute({
        viewer: phone,
        token,
        platform: 'ios',
        kinds: ['review-ready'],
      }),
    );
    expect(
      await Effect.runPromise(
        set.execute({ viewer: phone, token, platform: 'ios', kinds: [] }),
      ),
    ).toEqual({ kind: 'cleared' });
    expect(await Effect.runPromise(store.list())).toEqual([]);
  });

  it('refuses the computer owner and revoked devices, which have no phone to notify', async () => {
    const { store, set, clear } = setup();
    const refused = await Effect.runPromise(
      Effect.flip(
        set.execute({
          viewer: { kind: 'owner' },
          token,
          platform: 'ios',
          kinds: ['review-ready'],
        }),
      ),
    );
    const clearRefused = await Effect.runPromise(
      Effect.flip(clear.execute({ viewer: { kind: 'owner' } })),
    );
    const revoked = await Effect.runPromise(
      Effect.flip(
        set.execute({
          viewer: { kind: 'device', deviceId: 'revoked' },
          token,
          platform: 'ios',
          kinds: ['review-ready'],
        }),
      ),
    );
    expect(refused._tag).toBe('PushRegistrationDeviceRequiredError');
    expect(revoked._tag).toBe('PushRegistrationDeviceRequiredError');
    expect(clearRefused._tag).toBe('PushRegistrationDeviceRequiredError');
    expect(await Effect.runPromise(store.list())).toEqual([]);
  });
});

describe('SetPushRegistrationService with a repaired pairing', () => {
  it('keeps one registration per phone token, on the device that registered it last', async () => {
    const { store, set } = setup();
    for (const deviceId of ['phone', 'tablet'])
      await Effect.runPromise(
        set.execute({
          viewer: { kind: 'device', deviceId },
          token,
          platform: 'ios',
          kinds: ['review-ready'],
        }),
      );
    expect(
      (await Effect.runPromise(store.list())).map((entry) => entry.deviceId),
    ).toEqual(['tablet']);
  });
});

describe('ClearPushRegistrationService', () => {
  it('removes only the calling device registration', async () => {
    const { store, set, clear } = setup();
    await Effect.runPromise(
      set.execute({
        viewer: phone,
        token,
        platform: 'ios',
        kinds: ['review-ready'],
      }),
    );
    await Effect.runPromise(
      set.execute({
        viewer: { kind: 'device', deviceId: 'tablet' },
        token: 'ExponentPushToken[tablet]',
        platform: 'ios',
        kinds: ['agent-reply'],
      }),
    );
    await Effect.runPromise(clear.execute({ viewer: phone }));
    expect(
      (await Effect.runPromise(store.list())).map((entry) => entry.deviceId),
    ).toEqual(['tablet']);
  });
});
