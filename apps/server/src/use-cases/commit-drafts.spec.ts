import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createIsolatedGit } from '@porcelain/git/fixtures/isolated-git';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { CommitGenerator } from '../agents/interfaces/commit-generator.ts';
import { openApplication } from '../app.ts';
import type { GitActionScope } from '../models/git-action.ts';

let root: string;
let checkout: string;
let application: Awaited<ReturnType<typeof openApplication>>;
let scope: GitActionScope;
const generate = vi.fn<CommitGenerator['generate']>();
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'porcelain-commit-drafts-'));
  checkout = join(root, 'repo');
  await mkdir(checkout);
  vi.stubEnv('PATH', `${await createIsolatedGit(root)}:${process.env.PATH}`);
  vi.stubEnv('HOME', root);
  vi.stubEnv('XDG_CONFIG_HOME', root);
  execFileSync('git', ['init', '-b', 'main', checkout], { stdio: 'ignore' });
  execFileSync('git', ['-C', checkout, 'config', 'user.name', 'Fixture']);
  execFileSync('git', [
    '-C',
    checkout,
    'config',
    'user.email',
    'fixture@example.invalid',
  ]);
  await writeFile(join(checkout, 'a.ts'), 'first\n');
  generate
    .mockReset()
    .mockResolvedValue([{ message: 'Add first file', paths: ['a.ts'] }]);
  application = await openApplication({
    dataDirectory: join(root, 'state'),
    projectHome: join(root, 'state'),
    commitGenerator: {
      async models() {
        return [];
      },
      generate,
    },
  });
  const { project } = await application.register(checkout);
  scope = { projectId: project.id, worktreeId: project.worktrees[0]?.id ?? '' };
});
afterEach(async () => {
  await application.close();
  vi.unstubAllEnvs();
  await rm(root, { recursive: true, force: true });
});
async function draft() {
  const { status } = await application.gitStatus(scope.worktreeId);
  return application.draftCommits(scope, {
    mode: 'message',
    model: 'fixture:default',
    paths: ['a.ts'],
    expectedStatusToken: status.statusToken,
  });
}
it('returns guarded drafts whose targeted action check rejects later content', async () => {
  const result = await draft();
  expect(result.groups[0]?.message).toBe('Add first file');
  await writeFile(join(checkout, 'a.ts'), 'other\n');
  const { status } = await application.gitStatus(scope.worktreeId);
  const requestId = randomUUID();
  application.runGitAction(scope, {
    requestId,
    input: { action: 'commit', message: 'Add first file', paths: ['a.ts'] },
    expected: {
      headOid: status.headOid,
      branch: status.branch?.name ?? null,
      inProgress: status.inProgress ?? null,
      mergeHeadOid: status.mergeHeadOid ?? null,
      files: result.expectedFiles,
    },
  });
  await expect
    .poll(() => application.gitActionReceipt(requestId))
    .toMatchObject({ state: 'rejected', reason: 'CHANGED_SINCE_LOOKED' });
});
it('keeps ordinary reads available and returns the captured fingerprints without re-inspecting after generation', async () => {
  let finish:
    | ((value: { message: string; paths: string[] }[]) => void)
    | undefined;
  generate.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = draft();
  await vi.waitFor(() => expect(generate).toHaveBeenCalled(), {
    timeout: 5_000,
  });
  expect((await application.readTextFile(scope.worktreeId, 'a.ts')).text).toBe(
    'first\n',
  );
  await writeFile(join(checkout, 'a.ts'), 'other\n');
  finish?.([{ message: 'Old proposal', paths: ['a.ts'] }]);
  expect(await pending).toMatchObject({
    groups: [{ message: 'Old proposal', paths: ['a.ts'] }],
    expectedFiles: [{ path: 'a.ts', fingerprint: expect.any(String) }],
  });
}, 15_000);
it('rejects invented paths and duplicate assignments from a model', async () => {
  generate.mockResolvedValue([{ message: 'Invalid', paths: ['invented.ts'] }]);
  await expect(draft()).rejects.toThrow('did not cover');
  generate.mockResolvedValue([{ message: 'Invalid', paths: ['a.ts', 'a.ts'] }]);
  await expect(draft()).rejects.toThrow('did not cover');
});
it('rejects groups that split the source and destination of a rename', async () => {
  execFileSync('git', ['-C', checkout, 'add', 'a.ts']);
  execFileSync('git', ['-C', checkout, 'commit', '-m', 'Initial']);
  execFileSync('git', ['-C', checkout, 'mv', 'a.ts', 'b.ts']);
  generate.mockResolvedValue([
    { message: 'Remove old file', paths: ['a.ts'] },
    { message: 'Add new file', paths: ['b.ts'] },
  ]);
  const { status } = await application.gitStatus(scope.worktreeId);
  await expect(
    application.draftCommits(scope, {
      mode: 'groups',
      model: 'fixture:default',
      paths: ['a.ts', 'b.ts'],
      expectedStatusToken: status.statusToken,
    }),
  ).rejects.toThrow('did not cover');
});
