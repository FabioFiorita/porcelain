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
  toolCall,
  toolValue,
  worktreePath,
} from '../kit/requests.ts';
import { list, record, text } from '../kit/session.ts';

test('publication refuses dirty, unexplained removal, foreign PR, detached and unborn heads with actionable messages', async ({
  session,
}) => {
  const draft = sampleReview(session, 0, randomUUID(), randomUUID());
  const publish = () =>
    session.send({
      method: 'PUT',
      path: worktreePath(session, '/review'),
      body: draft,
    });
  const dirty = await publish();
  expect(dirty.status).toBe(409);
  expect(record(dirty.body).message).toBe(
    'Commit first: 1 files differ from HEAD (README.md)',
  );
  await commitReviewFixture(session);
  await session.git(
    'remote',
    'add',
    'origin',
    'git@github.com:owner/project.git',
  );
  const foreign = await session.send(
    toolCall(session, 1, 'publish_review', {
      ...draft,
      pullRequest: 'https://github.com/foreign/project/pull/42',
    }),
  );
  expect(foreign.status).toBe(200);
  expect(toolValue(foreign.body)).toMatchObject({
    statusCode: 409,
    message:
      'The pullRequest repository differs from origin. Use a PR from git@github.com:owner/project.git, or omit pullRequest.',
  });
  await session.remove('README.md');
  await commitReviewFixture(session);
  const removal = await publish();
  expect(removal.status).toBe(409);
  expect(record(removal.body).message).toBe(
    'Explain every removal: README.md is deleted but no verdict.removed entry names it.',
  );
  await session.git('checkout', '--detach');
  const detached = await publish();
  expect(detached.status).toBe(409);
  expect(record(detached.body).message).toBe(
    'Check out a branch first: HEAD is detached. Switch to the branch being reviewed, then publish.',
  );
  await session.git('checkout', '--orphan', 'unborn-review');
  const unborn = await publish();
  expect(unborn.status).toBe(409);
  expect(record(unborn.body).message).toBe(
    'Commit first: HEAD is not a commit. Create a commit on a branch, then publish.',
  );
});

test('MCP retains revisions and revision-owned comments, reads pinned code after worktree removal, and excludes delete_review', async ({
  session,
  server,
}) => {
  await session.git('checkout', 'main');
  await session.writeFile('README.md', session.fixture.readme.changed);
  await commitReviewFixture(session);
  const path = join(session.projectHome, 'retained-review');
  await session.git('worktree', 'add', '-b', 'retained-review', path);
  const git = (...args: string[]) =>
    execFileSync('git', ['-C', path, ...args], { encoding: 'utf8' }).trim();
  const call = (id: number, name: string, input: object) =>
    read(session, toolCall(session, id, name, { cwd: path, ...input }));
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
  const viewer = await session.live();
  const first = record(toolValue(await call(2, 'publish_review', draft)));
  expect(await viewer.next((notice) => notice.type === 'inventory')).toEqual({
    type: 'inventory',
  });
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
  const created = record(
    toolValue(
      await call(3, 'create_comment', {
        reviewId,
        anchor: { kind: 'file', filePath: 'README.md' },
        body: 'Read revision one.',
      }),
    ),
  );
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
  const second = record(
    toolValue(
      await call(4, 'publish_review', { ...draft, expectedRevision: 1 }),
    ),
  );
  expect(second).toMatchObject({
    reviewId,
    revision: 2,
    headOid: git('rev-parse', 'HEAD'),
  });
  const seen = record(
    toolValue(await call(5, 'read_review', { reviewId, revision: 1 })),
  );
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
  const comments = record(
    toolValue(await call(6, 'list_comments', { reviewId, scope: 'all' })),
  );
  expect(list(comments.threads).map((thread) => record(thread).review)).toEqual(
    [{ reviewId, revision: 1, headOid }],
  );
  const threadId = text(created.id);
  await call(7, 'reply_to_comment', {
    reviewId,
    threadId,
    body: 'Still revision one.',
  });
  await call(8, 'resolve_comment', { reviewId, threadId, resolved: true });
  await session.git('worktree', 'remove', path);
  await session.git('branch', '-D', 'retained-review');
  const retained = record(
    toolValue(await call(9, 'read_review', { reviewId, revision: 1 })),
  );
  expect(record(retained.revision).headOid).toBe(headOid);
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
  expect(server.tools).not.toContain('delete_review');
  await viewer.close();
});
