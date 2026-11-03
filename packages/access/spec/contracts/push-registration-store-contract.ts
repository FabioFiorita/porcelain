import { Effect } from 'effect';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { PushRegistrationStore } from '../../src/ports/push-registration-store.ts';

export type PushRegistrationStoreSubject = {
  store: PushRegistrationStore;
  close: () => Promise<void> | void;
};

const phone = {
  deviceId: 'phone',
  token: 'ExponentPushToken[phone]',
  platform: 'ios',
  kinds: ['review-ready', 'agent-reply'],
} as const;
const tablet = {
  deviceId: 'tablet',
  token: 'ExponentPushToken[tablet]',
  platform: 'android',
  kinds: ['agent-reply'],
} as const;

export function pushRegistrationStoreContract(
  subject: string,
  openSubject: () =>
    | PushRegistrationStoreSubject
    | Promise<PushRegistrationStoreSubject>,
): void {
  describe(subject, () => {
    let opened: PushRegistrationStoreSubject;

    beforeEach(async () => {
      opened = await openSubject();
    });

    afterEach(async () => {
      await opened.close();
    });

    const run = <A>(effect: Effect.Effect<A>) => Effect.runPromise(effect);

    it('holds no registrations before a device registers', async () => {
      expect(await run(opened.store.list())).toEqual([]);
    });

    it('keeps one registration per device, replacing its token and kinds', async () => {
      await run(opened.store.save(phone));
      await run(opened.store.save(tablet));
      await run(
        opened.store.save({
          ...phone,
          token: 'ExponentPushToken[renewed]',
          kinds: ['review-ready'],
        }),
      );
      const listed = await run(opened.store.list());
      expect(
        [...listed].sort((a, b) => a.deviceId.localeCompare(b.deviceId)),
      ).toEqual([
        {
          ...phone,
          token: 'ExponentPushToken[renewed]',
          kinds: ['review-ready'],
        },
        tablet,
      ]);
    });

    it('removes only the named device', async () => {
      await run(opened.store.save(phone));
      await run(opened.store.save(tablet));
      await run(opened.store.remove({ deviceId: 'phone' }));
      expect(await run(opened.store.list())).toEqual([tablet]);
    });
  });
}
