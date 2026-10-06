import { Effect } from 'effect';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EnvironmentIdentityReader } from '../../src/ports/environment-identity-reader.ts';

export type EnvironmentIdentityReaderSubject = {
  store: EnvironmentIdentityReader;
  close: () => Promise<void> | void;
};

export function environmentIdentityReaderContract(
  subject: string,
  openSubject: () =>
    | EnvironmentIdentityReaderSubject
    | Promise<EnvironmentIdentityReaderSubject>,
): void {
  describe(subject, () => {
    let opened: EnvironmentIdentityReaderSubject;

    beforeEach(async () => {
      opened = await openSubject();
    });

    afterEach(async () => {
      await opened.close();
    });

    it('answers one identity, the same on every read', async () => {
      const identity = await Effect.runPromise(opened.store.environmentId());
      expect(identity).toEqual(expect.any(String));
      expect(await Effect.runPromise(opened.store.environmentId())).toBe(
        identity,
      );
    });
  });
}
