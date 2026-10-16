import { Effect, type Exit } from 'effect';
import { AtomRegistry, AsyncResult, type Atom } from 'effect/reactivity';
import { expect, it } from 'vitest';
import { clientFixtures } from '../../../../spec/kit/client-fixture.ts';
import type { Transport } from '../../../shared/api/transport.ts';
import { readLayerMarks } from '../queries/publication.ts';
import { readReviewedFiles } from '../queries/reviewed.ts';
import { WORKTREE_RANGE, type ReviewableItem } from '../rules/reviewed.ts';
import { completeDecision, decisionCompletionBinding } from './decisions.ts';

const create = clientFixtures();
const scope = { projectId: 'project', worktreeId: 'a'.repeat(32) };
const fingerprint = 'b'.repeat(64);
const decision = {
  layerId: '11111111-1111-4111-8111-111111111111',
  fingerprint,
  reviewed: false,
};
const files = [
  { path: 'shared.ts', fingerprint, reviewStatus: 'unreviewed' as const },
  { path: 'owner.ts', fingerprint, reviewStatus: 'stale' as const },
];
const reviewedAt = '2026-10-15T12:00:00.000Z';
function read<A, E>(
  registry: AtomRegistry.AtomRegistry,
  atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
) {
  return Effect.runPromise(
    AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true }),
  );
}

function fixture(
  mode: 'success' | 'partial' | 'files-fail' | 'decision-fail' = 'success',
) {
  const writes: string[] = [];
  const bodies: unknown[] = [];
  let fileMarks: Array<{
    path: string;
    fingerprint: string;
    reviewedAt: string;
  }> = [];
  let layerMarks: Array<{
    layerId: string;
    fingerprint: string;
    reviewedAt: string;
    stale: boolean;
  }> = [];
  const transport: Transport = async (path, init) => {
    const layers = path.includes('reviewed-layers');
    if (init?.method === 'PUT' || init?.method === 'DELETE') {
      writes.push(`${init.method} ${path}`);
      bodies.push(init.body ? await new Response(init.body).json() : null);
      if (
        (layers && mode === 'decision-fail') ||
        (!layers && mode === 'files-fail')
      )
        return Promise.resolve(
          Response.json(
            {
              statusCode: 409,
              error: 'Conflict',
              message: 'Changed before write',
            },
            { status: 409 },
          ),
        );
      if (layers) {
        layerMarks =
          init.method === 'DELETE'
            ? []
            : [
                {
                  layerId: decision.layerId,
                  fingerprint,
                  reviewedAt,
                  stale: false,
                },
              ];
      } else {
        fileMarks = (mode === 'partial' ? files.slice(0, 1) : files).map(
          ({ path, fingerprint }) => ({ path, fingerprint, reviewedAt }),
        );
        return Promise.resolve(
          Response.json({
            worktreeId: scope.worktreeId,
            marks: fileMarks,
            marked: fileMarks.map(({ path }) => path),
            conflicts:
              mode === 'partial' ? [{ path: 'owner.ts', reason: 'stale' }] : [],
          }),
        );
      }
    }
    return Promise.resolve(
      Response.json({
        worktreeId: scope.worktreeId,
        marks: layers ? layerMarks : fileMarks,
      }),
    );
  };
  const subject = create(transport);
  const input = { connection: subject.connection, scope };
  const command = completeDecision(input);
  const marks = readReviewedFiles({ ...input, range: WORKTREE_RANGE });
  const layers = readLayerMarks(input);
  subject.registry.mount(marks);
  subject.registry.mount(layers);
  let pending: Promise<Exit.Exit<void, unknown>> | undefined;
  let continued = 0;
  const notices: string[] = [];
  const binding = decisionCompletionBinding(
    [
      AsyncResult.initial(),
      (value) => {
        subject.registry.set(command, value);
        const result = Effect.runPromiseExit(
          AtomRegistry.getResult(subject.registry, command, {
            suspendOnWaiting: true,
          }),
        );
        pending = result;
        return result;
      },
    ],
    (notice) => notices.push(`${notice.title}: ${notice.description}`),
  );
  return {
    ...subject,
    command,
    marks,
    layers,
    writes,
    bodies,
    notices,
    binding,
    start: (entries: readonly ReviewableItem[] = files, marked = false) =>
      binding.complete({
        files: entries,
        decision: { ...decision, reviewed: marked },
        onDone: () => {
          continued++;
        },
      }),
    finish: async () => {
      await pending;
      await Promise.resolve();
    },
    continued: () => continued,
  };
}

it('confirms file marks before the separate decision mark and only then continues', async () => {
  const subject = fixture();
  subject.start();
  await subject.finish();
  expect(subject.writes).toEqual([
    `PUT /api/worktrees/${scope.worktreeId}/reviewed-bulk`,
    `PUT /api/worktrees/${scope.worktreeId}/reviewed-layers`,
  ]);
  expect(subject.bodies).toEqual([
    {
      files: [
        { path: 'shared.ts', fingerprint },
        { path: 'owner.ts', fingerprint },
      ],
    },
    { layerId: decision.layerId, fingerprint, reviewed: true },
  ]);
  expect(subject.continued()).toBe(1);
  expect(subject.notices).toEqual([]);
  expect(await read(subject.registry, subject.marks)).toEqual({
    worktreeId: scope.worktreeId,
    marks: [
      { path: 'shared.ts', fingerprint, reviewedAt },
      { path: 'owner.ts', fingerprint, reviewedAt },
    ],
  });
  expect(await read(subject.registry, subject.layers)).toEqual({
    worktreeId: scope.worktreeId,
    marks: [
      { layerId: decision.layerId, fingerprint, reviewedAt, stale: false },
    ],
  });
});

it('retains successful files after a partial refusal without recording the decision or continuing', async () => {
  const subject = fixture('partial');
  subject.start();
  await subject.finish();
  expect(subject.writes).toEqual([
    `PUT /api/worktrees/${scope.worktreeId}/reviewed-bulk`,
  ]);
  expect(subject.continued()).toBe(0);
  expect(subject.notices).toEqual([
    'Some files changed before they were marked: Marked 1 file. 1 failed.',
  ]);
  expect(await read(subject.registry, subject.marks)).toEqual({
    worktreeId: scope.worktreeId,
    marks: [{ path: 'shared.ts', fingerprint, reviewedAt }],
  });
});

it.each(['files-fail', 'decision-fail'] as const)(
  'does not continue after %s',
  async (mode) => {
    const subject = fixture(mode);
    subject.start();
    await subject.finish();
    expect(subject.continued()).toBe(0);
    expect(subject.notices).toEqual([
      mode === 'files-fail'
        ? 'Could not mark the files reviewed: This review surface could not be loaded. Try again.'
        : 'Could not update the decision: This review surface could not be loaded. Try again.',
    ]);
    expect(subject.writes).toHaveLength(mode === 'files-fail' ? 1 : 2);
  },
);

it('records a decision with no owned files, including a stop whose shared file belongs elsewhere', async () => {
  const subject = fixture();
  subject.start([]);
  await subject.finish();
  expect(subject.writes).toEqual([
    `PUT /api/worktrees/${scope.worktreeId}/reviewed-layers`,
  ]);
  expect(subject.continued()).toBe(1);
});

it('fills missing file marks without rewriting an existing decision mark', async () => {
  const subject = fixture();
  subject.start(files, true);
  await subject.finish();
  expect(subject.writes).toEqual([
    `PUT /api/worktrees/${scope.worktreeId}/reviewed-bulk`,
  ]);
  expect(subject.continued()).toBe(1);
});

it('reopens only the decision, leaving individually reviewed files alone', async () => {
  const subject = fixture();
  subject.binding.reopen(decision);
  await subject.finish();
  expect(subject.writes).toEqual([
    `DELETE /api/worktrees/${scope.worktreeId}/reviewed-layers?layerId=${decision.layerId}`,
  ]);
  expect(subject.continued()).toBe(0);
});

it('refuses unavailable file fingerprints without recording the decision or continuing', async () => {
  const subject = fixture();
  subject.start([
    {
      path: 'unreadable.ts',
      fingerprint: undefined,
      reviewStatus: 'unreviewed',
    },
  ]);
  await subject.finish();
  expect(subject.writes).toEqual([]);
  expect(subject.continued()).toBe(0);
  expect(subject.notices).toEqual([
    'Some files changed before they were marked: No files marked. Skipped 1.',
  ]);
});
