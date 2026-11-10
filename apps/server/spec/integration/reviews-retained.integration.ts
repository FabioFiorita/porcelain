import { seedReview } from '../kit/seed-review.ts';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import { test } from '../kit/server-test.ts';
import {
  commitReviewFixture,
  read,
  sampleReview,
  worktreePath,
} from '../kit/requests.ts';
import { list, record, text } from '../kit/session.ts';

test('retained revisions and revision-owned comments read pinned code after worktree removal', async ({
  session,
}) => {
  await session.git('checkout', 'main');
  await session.writeFile('README.md', session.fixture.readme.changed);
  await commitReviewFixture(session);
  const path = join(session.projectHome, 'retained-review');
  await session.git('worktree', 'add', '-b', 'retained-review', path);
  const git = (...args: string[]) =>
    execFileSync('git', ['-C', path, ...args], { encoding: 'utf8' }).trim();
  writeFileSync(join(path, 'empty.ts'), '');
  git('add', 'empty.ts');
  git('commit', '-qm', 'Retain an empty changed file');
  const layerId = randomUUID();
  const { summaryHtml: _, ...draft } = sampleReview(
    session,
    0,
    layerId,
    randomUUID(),
  );
  const first = await seedReview(
    { ...session, repository: path },
    { ...draft, timing: 'record' },
  );
  expect(first.review?.timing).toBe('record');
  const reviewId = text(first.reviewId);
  const headOid = git('rev-parse', 'HEAD');
  expect(first).toMatchObject({ revision: 1, headOid });
  const basePath = `/api/reviews/${reviewId}`;
  expect(
    (await read(session, { method: 'GET', path: basePath })).review,
  ).toMatchObject({ latestRevision: 1 });
  expect(
    (await read(session, { method: 'GET', path: `${basePath}/revisions/1` }))
      .revision,
  ).toMatchObject({ headOid });
  const projectsAnswer = await session.send({
    method: 'GET',
    path: `/api/projects/${session.projectId}/reviews`,
  });
  expect(projectsAnswer.status).toBe(200);
  const projects = list(projectsAnswer.body);
  expect(projects.map((entry) => record(entry).reviewId)).toEqual([reviewId]);
  expect(
    await read(session, {
      method: 'PUT',
      path: `${basePath}/seen`,
      body: { revision: 1 },
    }),
  ).toEqual({ updated: true });
  const file = await read(session, {
    method: 'GET',
    path: `${basePath}/revisions/1/file`,
    query: { path: 'README.md' },
  });
  const headBlobOid = text(file.blobOid);
  expect(
    await read(session, {
      method: 'PUT',
      path: `${basePath}/marks`,
      body: { kind: 'file', revision: 1, path: 'README.md', headBlobOid },
    }),
  ).toEqual({ updated: true });
  expect(
    await read(session, { method: 'GET', path: `${basePath}/marks` }),
  ).toMatchObject({ files: [{ path: 'README.md', fingerprint: headBlobOid }] });
  expect(
    await read(session, {
      method: 'POST',
      path: `${basePath}/marks/removal`,
      body: { kind: 'file', path: 'README.md', headBlobOid },
    }),
  ).toEqual({ updated: true });
  const proof = await session.send({
    method: 'GET',
    path: `${basePath}/revisions/1/proof`,
    query: { proofId: randomUUID() },
  });
  expect(proof.status).toBe(404);
  const temporary = await read(session, {
    method: 'POST',
    path: `${basePath}/comments`,
    body: { anchor: { kind: 'change' }, body: 'Temporary reviewer thread.' },
  });
  const temporaryId = text(temporary.id);
  const messageId = text(record(list(temporary.messages)[0]).id);
  expect(
    await read(session, {
      method: 'PATCH',
      path: `${basePath}/comments/${temporaryId}/messages`,
      body: { messageId, body: 'Edited reviewer thread.' },
    }),
  ).toMatchObject({ messages: [{ body: 'Edited reviewer thread.' }] });
  const reply = await read(session, {
    method: 'POST',
    path: `${basePath}/comments/${temporaryId}/replies`,
    body: { body: 'Temporary reply.' },
  });
  const replyId = text(record(list(reply.messages)[1]).id);
  expect(
    await read(session, {
      method: 'DELETE',
      path: `${basePath}/comments/${temporaryId}/messages`,
      query: { messageId: replyId },
    }),
  ).toMatchObject({ threadId: temporaryId });
  const resolved = await read(session, {
    method: 'PUT',
    path: `${basePath}/comments/${temporaryId}`,
    body: { resolved: true },
  });
  expect(
    await read(session, {
      method: 'POST',
      path: `${basePath}/comments/resolved/deletion`,
      body: {
        threads: [{ threadId: temporaryId, revision: resolved.revision }],
      },
    }),
  ).toEqual({ deleted: [temporaryId], skipped: [] });
  const created = await read(session, {
    method: 'POST',
    path: `${basePath}/comments`,
    body: {
      anchor: { kind: 'file', filePath: 'README.md' },
      body: 'Read revision one.',
    },
  });
  expect(created.review).toEqual({ reviewId, revision: 1, headOid });
  await read(session, {
    method: 'POST',
    path: worktreePath(session, '/comments'),
    body: { anchor: { kind: 'change' }, body: 'Worktree-owned.' },
  });
  writeFileSync(
    join(path, 'README.md'),
    `${session.fixture.readme.changed}Revision two.\n`,
  );
  git('commit', '-am', 'Revise review');
  const second = await seedReview(
    { ...session, repository: path },
    { ...draft, expectedRevision: 1 },
  );
  expect(second).toMatchObject({
    reviewId,
    revision: 2,
    headOid: git('rev-parse', 'HEAD'),
  });
  const seen = await read(session, {
    method: 'GET',
    path: `${basePath}/revisions/1`,
  });
  expect(record(seen.review).latestRevision).toBe(2);
  expect(list(seen.revisions).map((entry) => record(entry).revision)).toEqual([
    1, 2,
  ]);
  expect(record(seen.revision).headOid).toBe(headOid);
  expect(
    list(record(seen.revision).files).map((file) => record(file).path),
  ).toEqual(['README.md', 'empty.ts']);
  expect(list(record(seen.revision).files)[1]).toMatchObject({
    path: 'empty.ts',
    status: 'added',
    newMode: '100644',
    newOid: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
  });
  const comments = (
    await session.read({ method: 'GET', path: `${basePath}/comments` })
  ).body;
  expect(list(comments).map((thread) => record(thread).review)).toEqual([
    { reviewId, revision: 1, headOid },
  ]);
  const threadId = text(created.id);
  await read(session, {
    method: 'POST',
    path: `${basePath}/comments/${threadId}/replies`,
    body: { body: 'Still revision one.' },
  });
  await read(session, {
    method: 'PUT',
    path: `${basePath}/comments/${threadId}`,
    body: { resolved: true },
  });
  await session.git('worktree', 'remove', path);
  await session.git('branch', '-D', 'retained-review');
  execFileSync('git', ['-C', session.repository, 'gc', '--prune=now']);
  const retained = await read(session, {
    method: 'GET',
    path: `${basePath}/revisions/1`,
  });
  expect(record(retained.revision).headOid).toBe(headOid);
  expect(record(record(retained.revision).content).timing).toBe('record');
  expect(
    await read(session, {
      method: 'GET',
      path: `/api/reviews/${reviewId}/revisions/1/file`,
      query: { path: 'README.md' },
    }),
  ).toMatchObject({ kind: 'text', text: session.fixture.readme.changed });
  const diff = await read(session, {
    method: 'POST',
    path: `/api/reviews/${reviewId}/revisions/1/diffs`,
    body: { paths: [['README.md']] },
  });
  expect(record(record(list(diff.diffs)[0]).content).kind).toBe('text');
  expect(record(record(list(diff.diffs)[0]).content).patch).toContain(
    '+A change to review.',
  );
  const retainedThreadsResponse = await session.send({
    method: 'GET',
    path: `/api/reviews/${reviewId}/comments`,
  });
  expect(retainedThreadsResponse.status).toBe(200);
  const retainedThreads = list(retainedThreadsResponse.body);
  expect(retainedThreads[0]).toMatchObject({
    resolved: true,
    review: { reviewId, revision: 1, headOid },
    messages: [{ body: 'Read revision one.' }, { body: 'Still revision one.' }],
  });
  expect(
    await read(session, {
      method: 'PATCH',
      path: basePath,
      body: { state: 'closed' },
    }),
  ).toEqual({ updated: true });
  expect(await read(session, { method: 'DELETE', path: basePath })).toEqual({
    deleted: true,
  });
});
