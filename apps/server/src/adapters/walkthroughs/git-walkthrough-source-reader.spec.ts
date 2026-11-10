import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NodeServices } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { expect, it } from 'vitest';
import { BranchRangeReader } from '@porcelain/changes/ports';
import { WalkthroughSourceReader } from '@porcelain/walkthroughs/ports';
import { withReadLease } from '@porcelain/effects/worktree';
import { LIMITS } from '../../config/limits.ts';
import { gitWalkthroughSourceReaderLayer } from './git-walkthrough-source-reader.ts';

it('uses the captured head when a commit lands after the branch range was read', async () => {
  const checkout = mkdtempSync(join(tmpdir(), 'walkthrough-head-race-'));
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
    let capturedHead = '';
    const ranges = Layer.succeed(BranchRangeReader, {
      readBranchRange: () =>
        Effect.sync(() => {
          writeFileSync(join(checkout, 'file.txt'), 'new committed content\n');
          git('add', '--all');
          git('commit', '-qm', 'Commit during capture');
          capturedHead = git('rev-parse', 'HEAD');
          return {
            kind: 'found' as const,
            head: { oid: base, ref: 'refs/heads/main' },
            base: { ref: 'refs/heads/main', oid: base },
            mergeBaseOid: base,
            commits: 0,
            files: [],
          };
        }),
      readBranchPatches: () => Effect.die('Unexpected patches'),
      readRetainedBranchPatches: () =>
        Effect.die('Unexpected retained patches'),
      listBranchBases: () => Effect.die('Unexpected bases'),
    });
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const source = yield* WalkthroughSourceReader;
        return yield* withReadLease(
          'worktree',
          source.read({
            worktreeId: 'worktree',
            worktreePath: checkout,
            base: 'main',
          }),
        );
      }).pipe(
        Effect.provide(
          gitWalkthroughSourceReaderLayer(LIMITS.git).pipe(
            Layer.provide(ranges),
            Layer.provide(NodeServices.layer),
          ),
        ),
      ),
    );
    expect(result.headOid).toBe(capturedHead);
    expect(result.includesUncommitted).toBe(false);
    expect(result.contentTreeOid).toBe(
      git('rev-parse', `${capturedHead}^{tree}`),
    );
    expect(result.patch).toContain('+new committed content');
  } finally {
    rmSync(checkout, { recursive: true, force: true });
  }
});
