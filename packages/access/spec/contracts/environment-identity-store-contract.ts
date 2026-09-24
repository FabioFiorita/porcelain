import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EnvironmentIdentityStore } from '../../src/ports/environment-identity-store.ts';

export type EnvironmentIdentityStoreSubject = {
  store: EnvironmentIdentityStore;
  close: () => void;
};

export function environmentIdentityStoreContract(
  subject: string,
  openSubject: () => EnvironmentIdentityStoreSubject,
): void {
  describe(subject, () => {
    let opened: EnvironmentIdentityStoreSubject;

    beforeEach(() => {
      opened = openSubject();
    });

    afterEach(() => {
      opened.close();
    });

    it('answers one identity, the same on every read', () => {
      const identity = opened.store.environmentId();
      expect(identity).toEqual(expect.any(String));
      expect(opened.store.environmentId()).toBe(identity);
    });
  });
}
