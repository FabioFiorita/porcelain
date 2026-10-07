import { Effect, Layer } from 'effect';
import {
  corroborates,
  identity,
  readGitdirPointer,
  readHead,
} from '@porcelain/git/discovery';
import { ListedWorktreeAccessReader } from '@porcelain/projects/ports';
import type { ListedWorktree } from '@porcelain/projects/models';
import { WorktreeCatalogStore } from '@porcelain/projects/ports';
import { captureGitPlatform } from './git-platform.ts';

export const gitWorktreeAccessReaderLayer = Layer.effect(
  ListedWorktreeAccessReader,
  Effect.gen(function* () {
    const catalog = yield* WorktreeCatalogStore;
    const provideGit = yield* captureGitPlatform();
    const onDisk = Effect.fn('GitWorktreeAccessReader.onDisk')(function* (
      worktree: ListedWorktree,
    ) {
      const current = yield* identity(worktree.administrativeDirectory).pipe(
        Effect.orElseSucceed(() => undefined),
      );
      if (current !== worktree.metadataIdentity) return undefined;
      const path = worktree.main
        ? worktree.path
        : yield* readGitdirPointer(worktree.administrativeDirectory);
      if (!path) return undefined;
      const branch = yield* readHead(worktree.administrativeDirectory);
      return {
        ...worktree,
        path,
        branch: branch ?? undefined,
        available: yield* corroborates(path, worktree.administrativeDirectory),
      };
    });
    return {
      known: Effect.fn('GitWorktreeAccessReader.known')(function* (input) {
        const entry = catalog.find(input);
        if (!entry) return { kind: 'missing' } as const;
        const current = yield* onDisk(entry.worktree).pipe(provideGit);
        return current
          ? ({ kind: 'found', worktree: current } as const)
          : ({ kind: 'unavailable' } as const);
      }),
    };
  }),
);
