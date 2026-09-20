import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { openApplication } from './app.ts';

const roots: string[] = [];
const applications: Awaited<ReturnType<typeof openApplication>>[] = [];
const agent = { kind: 'agent' } as const;
const owner = { kind: 'owner' } as const;

function git(path: string, ...args: string[]) {
  return execFileSync('git', ['-C', path, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_AUTHOR_NAME: 'Fixture',
      GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
      GIT_COMMITTER_NAME: 'Fixture',
      GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
    },
  });
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-status-'));
  roots.push(root);
  const checkout = join(root, 'atlas');
  await mkdir(checkout);
  git(checkout, 'init', '-b', 'main');
  await writeFile(join(checkout, 'notes.txt'), 'first\n');
  git(checkout, 'add', 'notes.txt');
  git(checkout, 'commit', '-m', 'Fixture');
  const dataDirectory = join(root, 'state');
  const app = await openApplication({
    dataDirectory,
    projectHome: dataDirectory,
  });
  await app.ready();
  applications.push(app);
  const { project } = await app.register(checkout);
  const worktreeId = project.worktrees[0]?.id ?? '';
  const dot = async () =>
    (await app.inventory()).inventory.projects[0]?.worktrees[0]?.status ?? null;
  return { app, checkout, project, worktreeId, dot };
}

afterEach(async () => {
  for (const app of applications.splice(0)) await app.close();
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});

it('shows review ready while layers are live, and stops when a commit archives them', async () => {
  const f = await fixture();
  expect(await f.dot()).toBeNull();
  await writeFile(join(f.checkout, 'notes.txt'), 'second\n');
  git(f.checkout, 'add', 'notes.txt');
  await f.app.replaceReviewLayers(f.worktreeId, 0, [
    {
      id: randomUUID(),
      title: 'Read this first',
      files: [{ path: 'notes.txt', scope: 'staged' }],
    },
  ]);
  expect(await f.dot()).toBe('pending');
  // Committing archives the layers, which is what puts the dot out. Marking
  // files reviewed deliberately does not: an agent can edit a path you
  // already marked, and the dot must not go dark for work that is still live.
  const scope = { projectId: f.project.id, worktreeId: f.worktreeId };
  const preparation = await f.app.prepareCommit(scope, { message: 'Reviewed' });
  f.app.executeCommit(scope, {
    requestId: randomUUID(),
    preparationId: preparation.id,
  });
  await expect.poll(() => f.dot()).toBeNull();
});

it('reports reviewed when every file the layers name has been marked', async () => {
  const f = await fixture();
  await writeFile(join(f.checkout, 'notes.txt'), 'second\n');
  git(f.checkout, 'add', 'notes.txt');
  await f.app.replaceReviewLayers(f.worktreeId, 0, [
    {
      id: randomUUID(),
      title: 'Read this first',
      files: [{ path: 'notes.txt', scope: 'staged' }],
    },
  ]);
  expect(await f.dot()).toBe('pending');
  const { changes } = await f.app.changes(f.worktreeId);
  const fingerprint = changes.find(
    (entry) => entry.path === 'notes.txt',
  )?.fingerprint;
  await f.app.setReviewedFile(f.worktreeId, {
    path: 'notes.txt',
    reviewed: true,
    fingerprint: fingerprint ?? '',
  });
  // Reviewed, waiting for a commit. Still a layer state: the handoff is live
  // until a commit archives it.
  expect(await f.dot()).toBe('reviewed');
  // The known limit of asking marks alone: the agent edits a file that was
  // already marked and this stays `reviewed`, because noticing would cost a
  // status read per worktree — the cost this replaced. Step 6's file watcher
  // is where that signal becomes free and turns it back to `pending`.
  await writeFile(join(f.checkout, 'notes.txt'), 'third\n');
  expect(await f.dot()).toBe('reviewed');
  // Unmarking is enough to make it pending again without any Git read.
  await f.app.removeReviewedFile(f.worktreeId, 'notes.txt');
  expect(await f.dot()).toBe('pending');
});

it('shows the agent replied until the owner says how far they have read', async () => {
  const f = await fixture();
  const [thread] = await f.app.comments(
    {
      kind: 'create',
      worktreeId: f.worktreeId,
      anchor: { kind: 'file', filePath: 'notes.txt' },
      body: 'Why this way?',
    },
    owner,
  );
  if (!thread) throw new Error('Missing fixture thread');
  // The owner asking is not news to the owner.
  expect(await f.dot()).toBeNull();
  const [answered] = await f.app.comments(
    {
      kind: 'reply',
      worktreeId: f.worktreeId,
      threadId: thread.id,
      body: 'Because of the lock ordering.',
    },
    agent,
  );
  if (!answered) throw new Error('Missing fixture reply');
  expect(await f.dot()).toBe('replied');
  // Listing the discussion is not reading it: only an explicit acknowledgement
  // of what was displayed clears the dot.
  await f.app.comments({ kind: 'list', worktreeId: f.worktreeId }, owner);
  expect(await f.dot()).toBe('replied');
  await f.app.markCommentsSeen(f.worktreeId, answered.revision);
  expect(await f.dot()).toBeNull();
  // A later reply is news again, and an older acknowledgement cannot bury it.
  const [again] = await f.app.comments(
    {
      kind: 'reply',
      worktreeId: f.worktreeId,
      threadId: thread.id,
      body: 'Also renamed it.',
    },
    agent,
  );
  expect(await f.dot()).toBe('replied');
  await f.app.markCommentsSeen(f.worktreeId, answered.revision);
  expect(await f.dot()).toBe('replied');
  await f.app.markCommentsSeen(f.worktreeId, again?.revision ?? 0);
  expect(await f.dot()).toBeNull();
  // A number from somewhere else cannot blind the worktree: acknowledging
  // past everything written leaves the next reply visible.
  await f.app.markCommentsSeen(f.worktreeId, 1_000_000);
  const [later] = await f.app.comments(
    {
      kind: 'reply',
      worktreeId: f.worktreeId,
      threadId: thread.id,
      body: 'One more thing.',
    },
    agent,
  );
  expect(await f.dot()).toBe('replied');
  await f.app.markCommentsSeen(f.worktreeId, later?.revision ?? 0);
  expect(await f.dot()).toBeNull();
  // Resolving the thread is a write, and a write takes a new revision — but
  // it is not the agent speaking again. Re-stamping would put the dot back up
  // for a reply that was read and closed.
  await f.app.comments(
    {
      kind: 'resolve',
      worktreeId: f.worktreeId,
      threadId: thread.id,
      resolved: true,
    },
    owner,
  );
  expect(await f.dot()).toBeNull();
});

it('lets a reply outrank published layers, and an answer of your own count as read', async () => {
  const f = await fixture();
  await f.app.replaceReviewLayers(f.worktreeId, 0, [
    { id: randomUUID(), title: 'Handoff', files: [] },
  ]);
  const [thread] = await f.app.comments(
    {
      kind: 'create',
      worktreeId: f.worktreeId,
      anchor: { kind: 'file', filePath: 'notes.txt' },
      body: 'Question',
    },
    owner,
  );
  if (!thread) throw new Error('Missing fixture thread');
  await f.app.comments(
    {
      kind: 'reply',
      worktreeId: f.worktreeId,
      threadId: thread.id,
      body: 'Answer',
    },
    agent,
  );
  // One dot: the reply is addressed to the owner and is newer than the
  // handoff that published the layers.
  expect(await f.dot()).toBe('replied');
  await f.app.comments(
    {
      kind: 'reply',
      worktreeId: f.worktreeId,
      threadId: thread.id,
      body: 'Thanks',
    },
    owner,
  );
  // Answering is reading. What remains is the handoff nobody has committed.
  expect(await f.dot()).toBe('pending');
});
