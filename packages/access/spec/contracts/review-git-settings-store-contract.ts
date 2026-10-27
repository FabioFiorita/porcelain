import { Effect } from 'effect';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ReviewGitSettingsStore } from '../../src/ports/review-git-settings-store.ts';

export type ReviewGitSettingsStoreSubject = {
  store: ReviewGitSettingsStore;
  close: () => Promise<void> | void;
};

export function reviewGitSettingsStoreContract(
  subject: string,
  openSubject: () =>
    | ReviewGitSettingsStoreSubject
    | Promise<ReviewGitSettingsStoreSubject>,
): void {
  describe(subject, () => {
    let opened: ReviewGitSettingsStoreSubject;

    beforeEach(async () => {
      opened = await openSubject();
    });

    afterEach(async () => {
      await opened.close();
    });

    it('holds no settings before the computer is configured', async () => {
      expect(await Effect.runPromise(opened.store.read())).toEqual({
        kind: 'unconfigured',
      });
    });

    it('reads back the last settings it wrote with their revision', async () => {
      await Effect.runPromise(
        opened.store.write({
          kind: 'configured',
          revision: 1,
          settings: {
            pullStrategy: 'merge',
            collapseSpecs: false,
            archiveDeleteWorktree: true,
            archiveDeleteLocalBranch: true,
            archiveDeleteRemoteBranch: true,
          },
        }),
      );
      await Effect.runPromise(
        opened.store.write({
          kind: 'configured',
          revision: 2,
          settings: {
            pullStrategy: 'rebase',
            collapseSpecs: true,
            archiveDeleteWorktree: false,
            archiveDeleteLocalBranch: true,
            archiveDeleteRemoteBranch: false,
          },
        }),
      );
      expect(await Effect.runPromise(opened.store.read())).toEqual({
        kind: 'configured',
        revision: 2,
        settings: {
          pullStrategy: 'rebase',
          collapseSpecs: true,
          archiveDeleteWorktree: false,
          archiveDeleteLocalBranch: true,
          archiveDeleteRemoteBranch: false,
        },
      });
    });
  });
}
