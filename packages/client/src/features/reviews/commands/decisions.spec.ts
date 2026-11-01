import {
  setReviewMarkRequestSchema,
  removeReviewMarkRequestSchema,
} from '@porcelain/contracts/reviews';
import { Effect, Schema, type Exit } from 'effect';
import { AtomRegistry, AsyncResult } from 'effect/reactivity';
import { expect, it } from 'vitest';
import {
  clientFixtures,
  readClientAtom,
} from '../../../../spec/kit/client-fixture.ts';
import { readReviewMarks } from '../queries/project-reviews.ts';
import { type ReviewableItem } from '../rules/reviewed.ts';
import { completeDecision, decisionCompletionBinding } from './decisions.ts';

const create = clientFixtures();
const reviewId = '22222222-2222-4222-8222-222222222222';
const fingerprint = 'b'.repeat(64);
const blobOid = 'c'.repeat(40);
const decision = {
  layerId: '11111111-1111-4111-8111-111111111111',
  fingerprint,
  reviewed: false,
};
const files = ['shared.ts', 'owner.ts'].map((path) => ({
  path,
  fingerprint: blobOid,
  reviewStatus: 'unreviewed' as const,
}));
const reviewedAt = '2026-10-15T12:00:00.000Z';
const fileWrites = files.map((file) => ({
  kind: 'file',
  revision: 2,
  path: file.path,
  headBlobOid: blobOid,
}));
const markedFiles = files.map((file) => ({
  path: file.path,
  fingerprint: blobOid,
  reviewedAt,
  stale: false,
}));

function fixture(
  mode: 'success' | 'partial' | 'files-fail' | 'decision-fail' = 'success',
) {
  const writes: unknown[] = [];
  const fileMarks: Array<{
    path: string;
    fingerprint: string;
    reviewedAt: string;
    stale: boolean;
  }> = [];
  let layerMarks: Array<{
    layerId: string;
    fingerprint: string;
    reviewedAt: string;
  }> = [];
  const subject = create(async (path, init) => {
    if (init?.method === 'PUT' || init?.method === 'POST') {
      expect(path).toBe(
        `/api/reviews/${reviewId}/marks${init.method === 'POST' ? '/removal' : ''}`,
      );
      const payload = Schema.decodeUnknownSync(
        init.method === 'POST'
          ? removeReviewMarkRequestSchema
          : setReviewMarkRequestSchema,
      )(await new Response(init.body).json());
      writes.push(payload);
      if (
        (payload.kind === 'decision' && mode === 'decision-fail') ||
        (payload.kind === 'file' &&
          (mode === 'files-fail' ||
            (mode === 'partial' && payload.path === 'owner.ts')))
      )
        return Response.json(
          {
            statusCode: 409,
            error: 'Conflict',
            message: 'Changed before write',
          },
          { status: 409 },
        );
      if (payload.kind === 'file')
        fileMarks.push({
          path: payload.path,
          fingerprint: payload.headBlobOid,
          reviewedAt,
          stale: false,
        });
      else
        layerMarks =
          init.method === 'POST'
            ? []
            : [{ layerId: decision.layerId, fingerprint, reviewedAt }];
      return Response.json({ updated: true });
    }
    expect(path).toBe(`/api/reviews/${reviewId}/marks`);
    return Response.json({ files: fileMarks, decisions: layerMarks });
  });
  const input = { connection: subject.connection, reviewId };
  const command = completeDecision(input);
  const marks = readReviewMarks(input);
  subject.registry.mount(marks);
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
    writes,
    marks,
    notices,
    binding,
    start: (entries: readonly ReviewableItem[] = files, marked = false) =>
      binding.complete({
        revision: 2,
        files: entries,
        decision: { ...decision, reviewed: marked },
        onDone: () => {
          continued++;
        },
      }),
    finish: async () => {
      await pending;
    },
    continued: () => continued,
    readMarks: () => readClientAtom(subject.registry, marks),
  };
}

it('writes every published blob before its decision and only then continues', async () => {
  const subject = fixture();
  subject.start();
  await subject.finish();
  expect(subject.writes).toEqual([
    ...fileWrites,
    { kind: 'decision', revision: 2, layerId: decision.layerId, fingerprint },
  ]);
  expect(subject.continued()).toBe(1);
  expect(subject.notices).toEqual([]);
  expect(await subject.readMarks()).toEqual({
    files: markedFiles,
    decisions: [{ layerId: decision.layerId, fingerprint, reviewedAt }],
  });
});

it('retains successful published file marks after a refusal without recording a decision or continuing', async () => {
  const subject = fixture('partial');
  subject.start();
  await subject.finish();
  expect(subject.writes).toEqual(fileWrites);
  expect(subject.continued()).toBe(0);
  expect(subject.notices).toEqual([
    'Could not mark the files reviewed: This review surface could not be loaded. Try again.',
  ]);
  expect(await subject.readMarks()).toEqual({
    files: [
      { path: 'shared.ts', fingerprint: blobOid, reviewedAt, stale: false },
    ],
    decisions: [],
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
    expect(subject.writes).toHaveLength(mode === 'files-fail' ? 1 : 3);
  },
);

it('records a fileless decision without inventing current-worktree files', async () => {
  const subject = fixture();
  subject.start([]);
  await subject.finish();
  expect(subject.writes).toEqual([
    { kind: 'decision', revision: 2, layerId: decision.layerId, fingerprint },
  ]);
  expect(subject.continued()).toBe(1);
});

it('fills missing file marks without rewriting an existing decision', async () => {
  const subject = fixture();
  subject.start(files, true);
  await subject.finish();
  expect(subject.writes).toEqual(fileWrites);
  expect(subject.continued()).toBe(1);
});

it('reopens only the decision, retaining its independently reviewed files', async () => {
  const subject = fixture();
  subject.binding.reopen(decision);
  await subject.finish();
  expect(subject.writes).toEqual([
    { kind: 'decision', layerId: decision.layerId, fingerprint },
  ]);
  expect(subject.continued()).toBe(0);
});

it('refuses unavailable blobs without recording a decision or continuing', async () => {
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
    'Some files cannot be marked reviewed: No files marked. Skipped 1. unreadable.ts cannot be marked reviewed because its fingerprint is unavailable (too large or unreadable). This stop stays open until every file can be marked reviewed.',
  ]);
});

it('keeps readable marks without advancing while another published blob is unavailable', async () => {
  const subject = fixture();
  const unavailable = {
    path: 'large.txt',
    fingerprint: undefined,
    reviewStatus: 'unreviewed' as const,
  };
  subject.start([...files, unavailable]);
  await subject.finish();
  subject.start([
    ...files.map((file) => ({ ...file, reviewStatus: 'reviewed' as const })),
    unavailable,
  ]);
  await subject.finish();
  expect(subject.writes).toEqual(fileWrites);
  expect(subject.continued()).toBe(0);
  expect(await subject.readMarks()).toEqual({
    files: markedFiles,
    decisions: [],
  });
  expect(subject.notices).toEqual([
    'Some files cannot be marked reviewed: Marked 2 files. Skipped 1. large.txt cannot be marked reviewed because its fingerprint is unavailable (too large or unreadable). This stop stays open until every file can be marked reviewed.',
    'Some files cannot be marked reviewed: No files marked. Skipped 1. 2 already reviewed. large.txt cannot be marked reviewed because its fingerprint is unavailable (too large or unreadable). This stop stays open until every file can be marked reviewed.',
  ]);
});
