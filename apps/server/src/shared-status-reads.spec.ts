import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { GitStatusObservation } from '@porcelain/git/dtos/git-status';
import { expect, it } from 'vitest';
import { openApplication } from './app.ts';
import { fakeInspection } from './testing/fake-inspection.ts';

const observation: GitStatusObservation = {
  statusToken: 'a'.repeat(64),
  headOid: 'b'.repeat(40),
  changes: [],
};

async function fixture(readStatus: (signal?: AbortSignal) => Promise<unknown>) {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), 'porcelain-shared-status-')),
  );
  const path = join(root, 'checkout');
  await mkdir(path);
  execFileSync('git', ['init', '-b', 'main', path], { stdio: 'ignore' });
  const app = await openApplication({
    dataDirectory: join(root, 'state'),
    projectHome: join(root, 'state'),
    inspectionGit: () =>
      fakeInspection({
        readStatus: readStatus as never,
        readBranchDetails: async () => ({
          remoteName: null,
          sourceRef: null,
          upstreamOid: null,
          stashes: [],
          headCommit: { subject: 'Fixture commit' },
        }),
        readDiff: async () => ({ kind: 'binary' }),
        readDiffs: async () => [],
      }),
  });
  await app.ready();
  const { project } = await app.register(path);
  const worktreeId = project.worktrees[0]?.id;
  if (!worktreeId) throw new Error('Fixture registration failed');
  return {
    app,
    worktreeId,
    close: () => rm(root, { recursive: true, force: true }),
  };
}

it('shares one underlying status read across simultaneous action-status requests', async () => {
  const blocked = Promise.withResolvers<void>();
  let reads = 0;
  const f = await fixture(async () => {
    reads += 1;
    await blocked.promise;
    return observation;
  });
  try {
    const first = f.app.gitStatus(f.worktreeId);
    const second = f.app.gitStatus(f.worktreeId);
    blocked.resolve();
    const results = await Promise.all([first, second]);
    for (const result of results)
      expect(result.status.headCommit).toEqual({ subject: 'Fixture commit' });
    // The second joined the first instead of reading, or taking a permit.
    expect(reads).toBe(1);
  } finally {
    blocked.resolve();
    await f.app.close();
    await f.close();
  }
});
