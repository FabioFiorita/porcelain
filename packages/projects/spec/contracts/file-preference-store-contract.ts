import { Effect } from 'effect';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FilePreference } from '../../src/models/file-preference.ts';
import type { FilePreferenceStore } from '../../src/ports/file-preference-store.ts';

export type FilePreferenceStoreSubject = {
  store: FilePreferenceStore;
  close: () => Promise<void> | void;
};

function pinned(path: string): FilePreference {
  return { path, pinned: true, hidden: false };
}

export function filePreferenceStoreContract(
  subject: string,
  openSubject: (
    projectIds: readonly string[],
  ) => FilePreferenceStoreSubject | Promise<FilePreferenceStoreSubject>,
): void {
  describe(subject, () => {
    let opened: FilePreferenceStoreSubject;
    let store: FilePreferenceStore;

    beforeEach(async () => {
      opened = await openSubject(['api', 'web']);
      store = opened.store;
    });

    afterEach(async () => {
      await opened.close();
    });

    it('lists no preferences and counts none for a project without any', async () => {
      await Effect.runPromise(
        store.save({ projectId: 'web', preference: pinned('README.md') }),
      );
      expect(await Effect.runPromise(store.list({ projectId: 'api' }))).toEqual(
        [],
      );
      expect(await Effect.runPromise(store.count({ projectId: 'api' }))).toBe(
        0,
      );
    });

    it('lists the preferences of the project in path order', async () => {
      await Effect.runPromise(
        store.save({ projectId: 'api', preference: pinned('src/b.ts') }),
      );
      await Effect.runPromise(
        store.save({ projectId: 'api', preference: pinned('README.md') }),
      );
      await Effect.runPromise(
        store.save({ projectId: 'api', preference: pinned('src/a.ts') }),
      );
      expect(await Effect.runPromise(store.list({ projectId: 'api' }))).toEqual(
        [pinned('README.md'), pinned('src/a.ts'), pinned('src/b.ts')],
      );
    });

    it('counts the preferences of the asked project only', async () => {
      await Effect.runPromise(
        store.save({ projectId: 'api', preference: pinned('a.ts') }),
      );
      await Effect.runPromise(
        store.save({ projectId: 'api', preference: pinned('b.ts') }),
      );
      await Effect.runPromise(
        store.save({ projectId: 'web', preference: pinned('a.ts') }),
      );
      expect(await Effect.runPromise(store.count({ projectId: 'api' }))).toBe(
        2,
      );
    });

    it('finds the preference of a path in the asked project', async () => {
      await Effect.runPromise(
        store.save({ projectId: 'api', preference: pinned('a.ts') }),
      );
      const hidden = { path: 'a.ts', pinned: false, hidden: true };
      await Effect.runPromise(
        store.save({ projectId: 'web', preference: hidden }),
      );
      expect(
        await Effect.runPromise(store.find({ projectId: 'web', path: 'a.ts' })),
      ).toEqual(hidden);
    });

    it('finds nothing for a path without a preference', async () => {
      await Effect.runPromise(
        store.save({ projectId: 'api', preference: pinned('a.ts') }),
      );
      expect(
        await Effect.runPromise(store.find({ projectId: 'api', path: 'b.ts' })),
      ).toBeUndefined();
      expect(
        await Effect.runPromise(store.find({ projectId: 'web', path: 'a.ts' })),
      ).toBeUndefined();
    });

    it('replaces the preference of a path saved again', async () => {
      await Effect.runPromise(
        store.save({ projectId: 'api', preference: pinned('a.ts') }),
      );
      const hidden = { path: 'a.ts', pinned: false, hidden: true };
      await Effect.runPromise(
        store.save({ projectId: 'api', preference: hidden }),
      );
      expect(await Effect.runPromise(store.list({ projectId: 'api' }))).toEqual(
        [hidden],
      );
      expect(await Effect.runPromise(store.count({ projectId: 'api' }))).toBe(
        1,
      );
    });

    it('removes the preference of the asked path in the asked project only', async () => {
      await Effect.runPromise(
        store.save({ projectId: 'api', preference: pinned('a.ts') }),
      );
      await Effect.runPromise(
        store.save({ projectId: 'api', preference: pinned('b.ts') }),
      );
      await Effect.runPromise(
        store.save({ projectId: 'web', preference: pinned('a.ts') }),
      );
      await Effect.runPromise(store.remove({ projectId: 'api', path: 'a.ts' }));
      expect(await Effect.runPromise(store.list({ projectId: 'api' }))).toEqual(
        [pinned('b.ts')],
      );
      expect(await Effect.runPromise(store.list({ projectId: 'web' }))).toEqual(
        [pinned('a.ts')],
      );
    });

    it('hands out copies, so changing a returned preference leaves the stored one unchanged', async () => {
      const saved = pinned('a.ts');
      await Effect.runPromise(
        store.save({ projectId: 'api', preference: saved }),
      );
      saved.hidden = true;
      Object.assign(
        (await Effect.runPromise(
          store.find({ projectId: 'api', path: 'a.ts' }),
        )) ?? {},
        {
          pinned: false,
        },
      );
      Object.assign(
        (await Effect.runPromise(store.list({ projectId: 'api' }))).at(0) ?? {},
        {
          pinned: false,
        },
      );
      expect(await Effect.runPromise(store.list({ projectId: 'api' }))).toEqual(
        [pinned('a.ts')],
      );
    });
  });
}
