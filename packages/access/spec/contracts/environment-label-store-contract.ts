import { Effect } from 'effect';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EnvironmentLabelStore } from '../../src/ports/environment-label-store.ts';

export type EnvironmentLabelStoreSubject = {
  store: EnvironmentLabelStore;
  close: () => Promise<void> | void;
};

export function environmentLabelStoreContract(
  subject: string,
  openSubject: () =>
    | EnvironmentLabelStoreSubject
    | Promise<EnvironmentLabelStoreSubject>,
): void {
  describe(subject, () => {
    let opened: EnvironmentLabelStoreSubject;

    beforeEach(async () => {
      opened = await openSubject();
    });

    afterEach(async () => {
      await opened.close();
    });

    it('holds no name or icon before one is saved', async () => {
      expect(await Effect.runPromise(opened.store.read())).toEqual({
        name: undefined,
        icon: undefined,
      });
    });

    it('reads back the last name and icon it saved', async () => {
      await Effect.runPromise(
        opened.store.save({ name: 'Workstation', icon: 'server' }),
      );
      await Effect.runPromise(
        opened.store.save({ name: 'Studio Mac', icon: 'laptop' }),
      );
      expect(await Effect.runPromise(opened.store.read())).toEqual({
        name: 'Studio Mac',
        icon: 'laptop',
      });
    });

    it('keeps an icon without a name and a name without an icon', async () => {
      await Effect.runPromise(
        opened.store.save({ name: undefined, icon: 'cloud' }),
      );
      expect(await Effect.runPromise(opened.store.read())).toEqual({
        name: undefined,
        icon: 'cloud',
      });
      await Effect.runPromise(
        opened.store.save({ name: 'Workstation', icon: undefined }),
      );
      expect(await Effect.runPromise(opened.store.read())).toEqual({
        name: 'Workstation',
        icon: undefined,
      });
    });

    it('forgets the name and icon when a save leaves them out', async () => {
      await Effect.runPromise(
        opened.store.save({ name: 'Workstation', icon: 'server' }),
      );
      await Effect.runPromise(
        opened.store.save({ name: undefined, icon: undefined }),
      );
      expect(await Effect.runPromise(opened.store.read())).toEqual({
        name: undefined,
        icon: undefined,
      });
    });
  });
}
