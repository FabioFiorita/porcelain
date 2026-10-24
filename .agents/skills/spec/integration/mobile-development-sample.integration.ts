import {
  readBranchChangesResponseSchema,
  readChangesResponseSchema,
} from '@porcelain/contracts/changes';
import { Environment } from '@porcelain/mobile/kit/environment';
import { seedDevelopmentSample } from '@porcelain/server/kit/development-sample';
import { serverReaders } from '@porcelain/server/kit/typed-readers';
import { Schema } from 'effect';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { expect, inject, test } from 'vitest';

const execute = promisify(execFile);

function readersOf(environment: Environment) {
  return serverReaders({
    read: (request) =>
      environment.server.read(environment.recorder, {
        method: 'GET',
        ...request,
      }),
    hits: () => environment.server.hits(),
  });
}

test('the mobile development fixture exposes nested files, a merge, two distinct dirty worktrees and a review conversation', async ({
  onTestFinished,
}) => {
  const environment = await Environment.start({
    build: inject('serverBuild'),
    title: 'Sample proof',
    label: 'Sample proof',
    workspace: false,
    fixture: 'development',
  });
  onTestFinished(async () => {
    await environment.stop();
  });
  const readers = readersOf(environment);
  const project = await readers.project();
  expect(project.worktrees).toHaveLength(2);
  const main = project.worktrees.find((worktree) => worktree.main);
  const offline = project.worktrees.find(
    (worktree) => worktree.branch === 'refs/heads/demo/offline-cache',
  );
  expect(main?.path).toBe(environment.server.repository);
  expect(offline?.path).toBe(
    join(environment.server.projectHome, 'offline-cache'),
  );
  if (main === undefined || offline === undefined)
    throw new Error('Both sample worktrees must be discoverable');
  const session = environment.server.session(environment.recorder, {
    projectId: project.id,
    worktreeId: main.id,
  });
  const paths = await readers.paths();
  expect(paths.paths.length).toBeGreaterThanOrEqual(25);
  expect(paths.paths).toEqual(
    expect.arrayContaining([
      'src/domain/shipment.ts',
      'docs/architecture/events.md',
      'docs/previews/dispatch.html',
      'assets/icons/truck.svg',
    ]),
  );
  expect(
    (await readers.directory('docs/operations')).entries.map(
      (entry) => entry.name,
    ),
  ).toEqual(expect.arrayContaining(['dispatch-guide.md', 'escalation.md']));
  const source = await session.readFile('src/data/dispatch-note.ts');
  expect(source.split('\n').some((line) => line.length > 300)).toBe(true);
  expect(await session.readFile('src/domain/shipment.ts')).toContain(
    "'awaiting-documents'",
  );
  const changes = await readers.changes();
  expect(changes.changes.map((change) => change.path)).toEqual([
    'docs/operations/next-shift.md',
  ]);
  expect(changes.changes[0]?.comparisons).toMatchObject([
    { scope: 'untracked' },
  ]);
  const committed = Schema.decodeUnknownSync(readBranchChangesResponseSchema)(
    (
      await session.read({
        method: 'GET',
        path: `/api/worktrees/${main.id}/branch-changes`,
        query: { base: 'refs/heads/porcelain-fixture-base' },
      })
    ).body,
  );
  expect(committed.files).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        path: 'src/domain/shipment.ts',
        status: 'modified',
      }),
      expect.objectContaining({
        path: 'src/ui/shipment-filters.tsx',
        status: 'added',
      }),
      expect.objectContaining({
        path: 'docs/operations/release-checklist.md',
        status: 'deleted',
      }),
      expect.objectContaining({
        path: 'docs/operations/dispatch-guide.md',
        oldPath: 'docs/operations/dispatch.md',
        status: 'renamed',
      }),
    ]),
  );
  const commits = await readers.commits();
  expect(commits.commits.map((commit) => commit.subject)).toEqual(
    expect.arrayContaining([
      'Model dispatch routes and shipments',
      'Document dispatch events and release handoff',
      'Queue offline dispatch notes',
      'Merge offline dispatch queue',
    ]),
  );
  const merge = commits.commits.find(
    (commit) => commit.subject === 'Merge offline dispatch queue',
  );
  expect(merge?.parentOids).toHaveLength(2);
  if (merge === undefined) throw new Error('The sample merge must be present');
  expect(
    (await session.git('rev-parse', `${merge.oid}^1`, `${merge.oid}^2`))
      .trim()
      .split('\n'),
  ).toHaveLength(2);
  const offlineChanges = Schema.decodeUnknownSync(readChangesResponseSchema)(
    (
      await environment.server.read(environment.recorder, {
        method: 'GET',
        path: `/api/worktrees/${offline.id}/changes`,
      })
    ).body,
  );
  expect(offlineChanges.changes.map((change) => change.path).sort()).toEqual([
    'docs/offline-sync.md',
    'docs/offline-walkthrough.md',
    'src/lib/offline-cache.ts',
  ]);
  expect(
    await readFile(join(offline.path, 'docs/offline-sync.md'), 'utf8'),
  ).toContain('Pending branch work');
  expect(
    (
      await execute('git', ['-C', offline.path, 'log', '-1', '--format=%s'])
    ).stdout.trim(),
  ).toBe('Queue offline dispatch notes');
  const review = await readers.publishedReview();
  expect(review.review?.layers.map((layer) => layer.title)).toEqual([
    'Keep document holds visible',
    'Filter completed deliveries',
    'Explain the dispatch handoff',
  ]);
  expect(
    review.review?.layers.flatMap((layer) =>
      layer.steps.map((step) => step.pointer.path),
    ),
  ).toContain('src/ui/shipment-filters.tsx');
  const comments = await readers.commentThreads();
  expect(comments).toHaveLength(2);
  expect(
    comments
      .find((thread) => thread.anchor.kind === 'file')
      ?.messages.map((message) => message.author),
  ).toEqual(['reviewer', 'agent']);
  expect(
    comments.find((thread) => thread.anchor.kind === 'codeRange')?.messages[0]
      ?.body,
  ).toBe('Please keep the delivered filter independent of route selection.');
  expect(await environment.devices()).toEqual([]);
  const statusBefore = await session.git('status', '--porcelain');
  await expect(
    seedDevelopmentSample(environment.server, environment.recorder),
  ).rejects.toThrow('fresh disposable fixture');
  expect(await session.git('status', '--porcelain')).toBe(statusBefore);
});

test('focused mobile verification keeps its one-README fixture with no published review or comments', async ({
  onTestFinished,
}) => {
  const environment = await Environment.start({
    build: inject('serverBuild'),
    title: 'Focused proof',
    label: 'Focused proof',
    workspace: false,
  });
  onTestFinished(async () => {
    await environment.stop();
  });
  const readers = readersOf(environment);
  expect((await readers.project()).worktrees).toHaveLength(1);
  expect((await readers.paths()).paths).toEqual(['README.md']);
  expect(
    (await readers.changes()).changes.map((change) => change.path),
  ).toEqual(['README.md']);
  expect((await readers.publishedReview()).review).toBeUndefined();
  expect(await readers.commentThreads()).toEqual([]);
  expect(await environment.devices()).toEqual([]);
});
