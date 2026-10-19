import { Effect } from 'effect';
import { NodeServices } from '@effect/platform-node';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { readBranchDiffs } from './read-branch-diffs.ts';
import { readBlobAtOid } from '../../inspection/index.ts';
import { pinReviewRevision } from '../../inspection/index.ts';
import { gitLimits } from '../../../spec/fixtures/git-limits.ts';

it('pins a commit idempotently and reads retained text and diffs after removing its worktree and branch', async () => {
  const root = mkdtempSync(join(tmpdir(), 'porcelain-review-pin-'));
  const repo = join(root, 'repo');
  const worktree = join(root, 'worktree');
  const git = (path: string, ...args: string[]) =>
    execFileSync('git', ['-C', path, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  const run = <A, E>(effect: Effect.Effect<A, E, NodeServices.NodeServices>) =>
    Effect.runPromise(effect.pipe(Effect.provide(NodeServices.layer)));
  try {
    execFileSync('git', ['init', '-q', repo]);
    git(repo, 'config', 'user.name', 'Porcelain');
    git(repo, 'config', 'user.email', 'test@example.com');
    writeFileSync(join(repo, 'README.md'), 'before\n');
    git(repo, 'add', '.');
    git(repo, 'commit', '-qm', 'Base');
    const baseOid = git(repo, 'rev-parse', 'HEAD');
    git(repo, 'worktree', 'add', '-qb', 'reviewed', worktree);
    writeFileSync(join(worktree, 'README.md'), 'after\n');
    git(worktree, 'commit', '-qam', 'Reviewed work');
    const headOid = git(worktree, 'rev-parse', 'HEAD');
    const commonDirectory = join(repo, '.git');
    const input = {
      reviewId: '10000000-0000-4000-8000-000000000001',
      revision: 1,
      headOid,
    };
    await run(pinReviewRevision(commonDirectory, input, gitLimits));
    await run(pinReviewRevision(commonDirectory, input, gitLimits));
    await expect(
      run(
        pinReviewRevision(
          commonDirectory,
          { ...input, headOid: baseOid },
          gitLimits,
        ),
      ),
    ).rejects.toMatchObject({ name: 'InvalidHistoryRequestError' });
    git(repo, 'worktree', 'remove', worktree);
    git(repo, 'branch', '-D', 'reviewed');
    git(repo, 'reflog', 'expire', '--expire=now', '--all');
    git(repo, 'gc', '--prune=now');
    expect(
      git(
        commonDirectory,
        'rev-parse',
        `refs/porcelain/reviews/${input.reviewId}/1`,
      ),
    ).toBe(headOid);
    const blob = await run(
      readBlobAtOid(
        { path: commonDirectory },
        { oid: headOid, path: 'README.md', maxBytes: 100 },
        gitLimits,
      ),
    );
    expect(blob).toEqual({
      kind: 'bytes',
      blobOid: '294186e497a23bf3fbfde12aacc7f720f668fe9a',
      bytes: Buffer.from('after\n'),
    });
    const diffs = await run(
      readBranchDiffs(
        { kind: 'repository', path: commonDirectory },
        { baseOid, headOid, paths: [['README.md']] },
        gitLimits,
      ),
    );
    expect(diffs.kind).toBe('read');
    const content =
      diffs.kind === 'read' ? diffs.sections?.get('README.md') : undefined;
    if (content?.kind !== 'text')
      throw new Error('Expected the retained text diff');
    expect(content.patch).toContain('-before\n+after\n');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
