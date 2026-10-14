import { execFile } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { Schema } from 'effect';
import { expect, inject, test } from 'vitest';
import { readChangesResponseSchema } from '@porcelain/contracts/changes';
import { Environment } from '@porcelain/mobile/kit/environment';
import { seedDevelopmentSample } from '@porcelain/server/kit/development-sample';
import { serverReaders } from '@porcelain/server/kit/typed-readers';
import { optionsSchema } from '../../mobile-verify/scripts/instance.ts';

const execute = promisify(execFile);

test('retained mobile instances without a fixture remain focused and new development selections survive decoding', () => {
  const retained = {
    kind: 'iphone',
    host: null,
    simulatorLimit: 2,
    manualPairing: false,
  };
  expect(() => Schema.decodeUnknownSync(optionsSchema)(retained)).not.toThrow();
  expect(Schema.decodeUnknownSync(optionsSchema)(retained).fixture).toBe(
    'focused',
  );
  expect(
    Schema.decodeUnknownSync(optionsSchema)({
      ...retained,
      fixture: 'development',
    }).fixture,
  ).toBe('development');
});

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
  const started = performance.now();
  const environment = await Environment.start({
    build: inject('serverBuild'),
    title: 'Sample proof',
    label: 'Sample proof',
    workspace: false,
    fixture: 'development',
  });
  const elapsedMs = Math.round(performance.now() - started);
  onTestFinished(async () => {
    const failure = await environment.stop();
    if (failure !== undefined) throw new Error(failure);
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
  expect(
    changes.changes.find((change) => change.path === 'src/domain/shipment.ts')
      ?.comparisons,
  ).toMatchObject([{ kind: 'modified', scope: 'unstaged' }]);
  expect(
    changes.changes.find(
      (change) => change.path === 'src/ui/shipment-filters.tsx',
    )?.comparisons,
  ).toMatchObject([{ scope: 'untracked' }]);
  expect(
    changes.changes.find(
      (change) => change.path === 'docs/operations/release-checklist.md',
    )?.comparisons,
  ).toMatchObject([{ kind: 'deleted' }]);
  expect(
    changes.changes.find(
      (change) => change.path === 'docs/operations/dispatch-guide.md',
    )?.comparisons,
  ).toMatchObject([
    { kind: 'renamed', oldPath: 'docs/operations/dispatch.md' },
  ]);
  const commits = await readers.commits();
  expect(commits.commits.map((commit) => commit.subject)).toEqual(
    expect.arrayContaining([
      'Model dispatch routes and shipments',
      'Document dispatch events and release handoff',
      'Queue offline dispatch notes',
      'Merge offline dispatch queue',
    ]),
  );
  expect(
    (await session.git('rev-parse', 'HEAD^1', 'HEAD^2')).trim().split('\n'),
  ).toHaveLength(2);
  const merge = commits.commits.find(
    (commit) => commit.subject === 'Merge offline dispatch queue',
  );
  expect(merge?.parentOids).toHaveLength(2);
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
  const evidence = await mkdtemp(
    join(tmpdir(), 'porcelain-development-sample-proof-'),
  );
  await writeFile(
    join(evidence, 'sample.json'),
    JSON.stringify(
      environment.recorder.redact({
        elapsedMs,
        project,
        paths,
        changes,
        commits,
        offlineChanges,
        review,
        comments,
        steps: environment.recorder.steps,
      }),
      null,
      2,
    ),
  );
  console.log(
    `Development sample startup and seed: ${elapsedMs}ms; evidence ${evidence}/sample.json`,
  );
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
    const failure = await environment.stop();
    if (failure !== undefined) throw new Error(failure);
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
