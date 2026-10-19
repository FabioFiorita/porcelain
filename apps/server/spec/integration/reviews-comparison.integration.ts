import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Schema } from 'effect';
import { expect } from 'vitest';
import {
  compareReviewResponseSchema,
  readReviewInterdiffResponseSchema,
} from '@porcelain/contracts/reviews';
import { test } from '../kit/server-test.ts';
import {
  commitReviewFixture,
  read,
  sampleReview,
  toolCall,
  toolValue,
} from '../kit/requests.ts';
import { record, text } from '../kit/session.ts';

test('compares retained review blobs across a rebase, carries marks, reports conversation/proof and survives worktree removal', async ({
  session,
}) => {
  await commitReviewFixture(session);
  await session.git('branch', 'comparison-base');
  const path = join(session.projectHome, 'comparison-branch');
  await session.git('worktree', 'add', '-b', 'comparison-branch', path);
  const git = (...args: string[]) =>
    execFileSync('git', ['-C', path, ...args], { encoding: 'utf8' }).trim();
  const write = (name: string, value: string) =>
    writeFileSync(join(path, name), value);
  const call = async (id: number, name: string, input: object) =>
    record(
      toolValue(
        await read(
          session,
          toolCall(session, id, name, { cwd: path, ...input }),
        ),
      ),
    );
  const layerId = randomUUID();
  const draft = {
    ...sampleReview(session, 0, layerId, randomUUID()),
    base: 'refs/heads/comparison-base',
  };
  for (const layer of draft.layers)
    for (const step of layer.steps) {
      step.pointer.startLine += 1;
      step.pointer.endLine += 1;
    }
  write('README.md', `${session.fixture.readme.changed}First decision.\n`);
  write('stable.ts', 'export const stable = true;\n');
  git('add', '-A');
  git('commit', '-qm', 'First review revision');
  const first = await call(1, 'publish_review', {
    ...draft,
    proof: { checks: [{ name: 'focused tests', result: 'fail' }] },
  });
  const reviewId = text(first.reviewId);
  const url = `/api/reviews/${reviewId}`;
  const compare = async (query: Record<string, string> = {}) =>
    Schema.decodeUnknownSync(compareReviewResponseSchema)(
      await read(session, { method: 'GET', path: `${url}/compare`, query }),
    );
  const interdiff = async (
    file = 'README.md',
    query: Record<string, string> = {},
  ) =>
    Schema.decodeUnknownSync(readReviewInterdiffResponseSchema)(
      await read(session, {
        method: 'GET',
        path: `${url}/interdiff`,
        query: { ...query, path: file },
      }),
    );
  expect(await compare()).toMatchObject({
    from: undefined,
    to: 1,
    comparison: undefined,
    unknown: [{ area: 'baseline' }],
  });
  expect(await interdiff()).toEqual({
    kind: 'unavailable',
    reason: 'no-baseline',
  });
  await read(session, {
    method: 'PUT',
    path: `${url}/seen`,
    body: { revision: 1 },
  });
  for (const name of ['README.md', 'stable.ts']) {
    const blob = git('rev-parse', `HEAD:${name}`);
    await read(session, {
      method: 'PUT',
      path: `${url}/marks`,
      body: { kind: 'file', revision: 1, path: name, headBlobOid: blob },
    });
  }
  const review = record(await read(session, { method: 'GET', path: url }));
  const content = record(record(review.revision).content);
  const layers = content.layers;
  if (!Array.isArray(layers)) throw new Error('Expected published layers');
  await read(session, {
    method: 'PUT',
    path: `${url}/marks`,
    body: {
      kind: 'decision',
      revision: 1,
      layerId,
      fingerprint: text(record(layers[0]).fingerprint),
    },
  });
  const created = await call(2, 'create_comment', {
    reviewId,
    anchor: { kind: 'change' },
    body: 'Agent message after revision one.',
  });
  const threadId = text(created.id);
  await call(3, 'resolve_comment', { reviewId, threadId, resolved: true });
  write('README.md', `${session.fixture.readme.changed}Second decision.\n`);
  git('commit', '-am', 'Change only the decision file');
  await session.git('checkout', 'comparison-base');
  await session.writeFile(
    'unrelated-main.ts',
    'export const unrelated = true;\n',
  );
  await session.git('add', 'unrelated-main.ts');
  await session.git('commit', '-m', 'Advance the base with an unrelated file');
  git('rebase', 'comparison-base');
  expect(git('diff', '--name-only', text(first.headOid), 'HEAD')).toBe(
    'README.md\nunrelated-main.ts',
  );
  const second = await call(4, 'publish_review', {
    ...draft,
    expectedRevision: 1,
    layers: draft.layers.map((layer) => ({
      ...layer,
      summary: 'The revised decision',
    })),
    verdict: {
      ...draft.verdict,
      recommendation: 'hold',
      notProven: [{ what: 'Native apps', why: 'Server-only fixture' }],
    },
    proof: { checks: [{ name: 'focused tests', result: 'pass' }] },
  });
  expect(second).toMatchObject({ reviewId, revision: 2 });
  const answer = await compare();
  expect(answer).toMatchObject({
    reviewId,
    from: 1,
    to: 2,
    unknown: [],
    comparison: {
      files: [
        {
          path: 'README.md',
          change: 'changed',
          headChanged: true,
          baseChanged: false,
        },
        {
          path: 'stable.ts',
          change: 'unchanged',
          headChanged: false,
          baseChanged: false,
        },
      ],
      decisions: {
        affected: [layerId],
        new: [],
        gone: [],
        resetMarks: [{ layerId }],
      },
      fileMarks: {
        carriedCount: 1,
        carried: [{ path: 'stable.ts' }],
        reset: [{ path: 'README.md' }],
      },
      verdict: {
        recommendation: { from: 'merge', to: 'hold' },
        notProven: {
          added: [{ what: 'Native apps', why: 'Server-only fixture' }],
          dropped: [],
        },
      },
      conversation: {
        agentMessageCount: 1,
        agentThreadIds: [threadId],
        resolvedThreadCount: 1,
        resolvedThreadIds: [threadId],
      },
      proof: {
        publishedChecks: [{ name: 'focused tests', result: 'pass' }],
        changedResults: [
          {
            from: { name: 'focused tests', result: 'fail' },
            to: { name: 'focused tests', result: 'pass' },
          },
        ],
      },
    },
  });
  expect(await compare({ from: '1', to: '2' })).toEqual(answer);
  expect(
    (await compare({ from: '2', to: '2' })).comparison?.files.map(
      (file) => file.change,
    ),
  ).toEqual(['unchanged', 'unchanged']);
  const patch = await interdiff();
  expect(patch).toMatchObject({
    kind: 'diff',
    from: 1,
    to: 2,
    path: 'README.md',
    diffs: [{ content: { kind: 'text' } }],
  });
  const contentPatch =
    patch.kind === 'diff' ? patch.diffs[0]?.content : undefined;
  if (contentPatch?.kind !== 'text') throw new Error('Expected text interdiff');
  expect(contentPatch.patch).toContain('-First decision.');
  expect(contentPatch.patch).toContain('+Second decision.');
  expect(contentPatch.patch).not.toContain('unrelated');
  expect(await interdiff('stable.ts')).toEqual({
    kind: 'unavailable',
    reason: 'not-changed',
  });
  expect(await interdiff('unrelated-main.ts')).toEqual({
    kind: 'unavailable',
    reason: 'path-not-reviewed',
  });
  for (const endpoint of ['compare', 'interdiff']) {
    await read(
      session,
      {
        method: 'GET',
        path: `${url}/${endpoint}`,
        query: {
          from: '2',
          to: '1',
          ...(endpoint === 'interdiff' ? { path: 'README.md' } : {}),
        },
      },
      400,
    );
    await read(
      session,
      {
        method: 'GET',
        path: `${url}/${endpoint}`,
        query: {
          from: '1',
          to: '99',
          ...(endpoint === 'interdiff' ? { path: 'README.md' } : {}),
        },
      },
      404,
    );
    await read(
      session,
      {
        method: 'GET',
        path: `${url}/${endpoint}`,
        query: {
          from: '0',
          ...(endpoint === 'interdiff' ? { path: 'README.md' } : {}),
        },
      },
      400,
    );
  }
  await session.git('worktree', 'remove', path);
  await session.git('branch', '-D', 'comparison-branch');
  execFileSync('git', ['-C', session.repository, 'gc', '--prune=now']);
  expect(await compare({ from: '1', to: '2' })).toEqual(answer);
  expect(await interdiff('README.md', { from: '1', to: '2' })).toEqual(patch);
});
