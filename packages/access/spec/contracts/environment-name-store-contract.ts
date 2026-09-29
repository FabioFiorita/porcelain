import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EnvironmentNameStore } from '../../src/ports/environment-name-store.ts';

export type EnvironmentNameStoreSubject = {
  store: EnvironmentNameStore;
  close: () => void;
};

export function environmentNameStoreContract(
  subject: string,
  openSubject: () => EnvironmentNameStoreSubject,
): void {
  describe(subject, () => {
    let opened: EnvironmentNameStoreSubject;

    beforeEach(() => {
      opened = openSubject();
    });

    afterEach(() => {
      opened.close();
    });

    it('holds no name before one is saved', () => {
      expect(opened.store.read()).toEqual({ name: undefined });
    });

    it('reads back the last name it saved', () => {
      opened.store.save({ name: 'Workstation' });
      opened.store.save({ name: 'Studio Mac' });
      expect(opened.store.read()).toEqual({ name: 'Studio Mac' });
    });

    it('forgets the name when a save leaves it out', () => {
      opened.store.save({ name: 'Workstation' });
      opened.store.save({ name: undefined });
      expect(opened.store.read()).toEqual({ name: undefined });
    });
  });
}
