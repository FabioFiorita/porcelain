import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EnvironmentIdentityReader } from '../../src/ports/environment-identity-reader.ts';

export type EnvironmentIdentityReaderSubject = {
  store: EnvironmentIdentityReader;
  close: () => void;
};

export function environmentIdentityReaderContract(
  subject: string,
  openSubject: () => EnvironmentIdentityReaderSubject,
): void {
  describe(subject, () => {
    let opened: EnvironmentIdentityReaderSubject;

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
