import { Effect } from 'effect';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EnvironmentNameStore } from '../../src/ports/environment-name-store.ts';

export type EnvironmentNameStoreSubject = {
  store: EnvironmentNameStore;
  close: () => Promise<void> | void;
};

export function environmentNameStoreContract(
  subject: string,
  openSubject: () =>
    | EnvironmentNameStoreSubject
    | Promise<EnvironmentNameStoreSubject>,
): void {
  describe(subject, () => {
    let opened: EnvironmentNameStoreSubject;

    beforeEach(async () => {
      opened = await openSubject();
    });

    afterEach(async () => {
      await opened.close();
    });

    it('holds no name before one is saved', async () => {
      expect(await Effect.runPromise(opened.store.read())).toEqual({
        name: undefined,
      });
    });

    it('reads back the last name it saved', async () => {
      await Effect.runPromise(opened.store.save({ name: 'Workstation' }));
      await Effect.runPromise(opened.store.save({ name: 'Studio Mac' }));
      expect(await Effect.runPromise(opened.store.read())).toEqual({
        name: 'Studio Mac',
      });
    });

    it('forgets the name when a save leaves it out', async () => {
      await Effect.runPromise(opened.store.save({ name: 'Workstation' }));
      await Effect.runPromise(opened.store.save({ name: undefined }));
      expect(await Effect.runPromise(opened.store.read())).toEqual({
        name: undefined,
      });
    });
  });
}
