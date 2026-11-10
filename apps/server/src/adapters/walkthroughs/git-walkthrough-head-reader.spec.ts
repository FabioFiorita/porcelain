import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NodeServices } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { expect, it } from 'vitest';
import {
  BranchRangeReader,
  ChangeStatusReader,
} from '@porcelain/changes/ports';
import { WalkthroughHeadReader } from '@porcelain/walkthroughs/ports';
import { withReadLease } from '@porcelain/effects/worktree';
import { LIMITS } from '../../config/limits.ts';
import { gitWalkthroughHeadReaderLayer } from './git-walkthrough-head-reader.ts';

it('returns a recoverable failure when content capture exceeds the Git output limit', async () => {
  const checkout = mkdtempSync(join(tmpdir(), 'walkthrough-head-limit-'));
  const git = (...args: string[]) =>
    execFileSync('git', ['-C', checkout, ...args], { encoding: 'utf8' }).trim();
  try {
    git('init', '-qb', 'main');
    git('config', 'user.name', 'Fixture');
    git('config', 'user.email', 'fixture@example.test');
    writeFileSync(join(checkout, 'file.txt'), 'base\n');
    git('add', '--all');
    git('commit', '-qm', 'Base');
    const base = git('rev-parse', 'HEAD');
    const ranges = Layer.succeed(BranchRangeReader, {
      readBranchRange: () =>
        Effect.succeed({
          kind: 'found' as const,
          head: { oid: base, ref: 'refs/heads/main' },
          base: { ref: 'refs/heads/main', oid: base },
          mergeBaseOid: base,
          commits: 0,
          files: [],
        }),
      readBranchPatches: () => Effect.die('Unexpected patches'),
      readRetainedBranchPatches: () =>
        Effect.die('Unexpected retained patches'),
      listBranchBases: () => Effect.die('Unexpected bases'),
    });
    const status = Layer.succeed(ChangeStatusReader, {
      readStatus: () => Effect.die('Unexpected status'),
      readSummary: () => Effect.die('Unexpected summary'),
      readBranchDetails: () => Effect.die('Unexpected branch details'),
    });
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const heads = yield* WalkthroughHeadReader;
        return yield* withReadLease(
          'worktree',
          heads
            .content({
              worktreeId: 'worktree',
              worktreePath: checkout,
              baseRef: 'refs/heads/main',
            })
            .pipe(Effect.catch(() => Effect.succeed('freshness unavailable'))),
        );
      }).pipe(
        Effect.provide(
          gitWalkthroughHeadReaderLayer({ ...LIMITS.git, outputBytes: 1 }).pipe(
            Layer.provide(Layer.merge(ranges, status)),
            Layer.provide(NodeServices.layer),
          ),
        ),
      ),
    );
    expect(result).toBe('freshness unavailable');
  } finally {
    rmSync(checkout, { recursive: true, force: true });
  }
});
