import {
  readReview,
  readProjectReviews,
  readReviewMarks,
  readReviewRevisionFile,
  readReviewRevisionDiffs,
  readReviewRevisionProof,
  readReviewComments,
  reviewCommands,
} from '@porcelain/client/reviews';
import { text } from '@porcelain/server/kit/session';
import { commentCommands, reviewedCommands } from '@porcelain/client/reviews';
import { expect } from 'vitest';
import { join } from 'node:path';
import { Schema } from 'effect';
import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import { inventory } from '@porcelain/server/kit/reads';
import { test } from '@porcelain/server/kit/server-test';
import {
  read,
  sampleReview,
  commitReviewFixture,
  worktreePath,
} from '@porcelain/server/kit/requests';
import { readPublishedReview } from '@porcelain/client/reviews';
import { threadWriteTarget } from '@porcelain/client/reviews/rules';
import { readCommentThreads } from '@porcelain/client/reviews';
import { readReviewedFiles, readLayerMarks } from '@porcelain/client/reviews';
import { readChanges } from '@porcelain/client/changes';
import { readChangeDiffs } from '@porcelain/client/changes';
import { connection } from '../kit/connection.ts';

test('read an unpublished review, then its published layers and discussion', async ({
  server,
  session,
}) => {
  const {
    connected,
    scope,
    read: nativeRead,
    registry,
  } = await connection(server, session);
  expect(
    await nativeRead(readPublishedReview({ scope, connection: connected })),
  ).toBeNull();
  const layerId = '75dc6a36-a001-4d00-b511-c45430b99403';
  await commitReviewFixture(session);
  await read(session, {
    method: 'PUT',
    path: worktreePath(session, '/review'),
    body: sampleReview(
      session,
      0,
      layerId,
      '75dc6a36-a001-4d00-b511-c45430b99404',
    ),
  });
  await read(session, {
    method: 'POST',
    path: worktreePath(session, '/comments'),
    body: {
      anchor: { kind: 'file', filePath: session.fixture.readme.path },
      body: 'Please explain this line.',
    },
  });
  const published = readPublishedReview({ scope, connection: connected });
  registry.refresh(published);
  const review = await nativeRead(published);
  expect(review).toMatchObject({
    worktreeId: scope.worktreeId,
    environmentId: connected.environmentId,
    revision: 1,
    active: true,
    layers: [{ id: layerId, title: 'Readme', summary: 'Adds a line' }],
  });
  expect(review?.summary.token).toMatch(/^[0-9a-f-]{36}$/);
  const threads = await nativeRead(
    readCommentThreads({ scope, connection: connected }),
  );
  expect(threads).toHaveLength(1);
  expect(threads[0]?.messages[0]?.body).toBe('Please explain this line.');
  expect(
    await nativeRead(readReviewedFiles({ scope, connection: connected })),
  ).toMatchObject({ worktreeId: scope.worktreeId, marks: [] });
  expect(
    await nativeRead(readLayerMarks({ scope, connection: connected })),
  ).toEqual({
    worktreeId: scope.worktreeId,
    marks: [],
  });
});

test('read changes and the exact Git patch, and refuse a stale diff snapshot', async ({
  server,
  session,
}) => {
  await session.writeFile(
    session.fixture.readme.path,
    `${session.fixture.readme.changed}A new uncommitted line.\n`,
  );
  const {
    connected,
    scope,
    read: nativeRead,
  } = await connection(server, session);
  const changes = await nativeRead(
    readChanges({ scope, connection: connected }),
  );
  expect(changes.changes).toHaveLength(1);
  const file = changes.changes[0];
  if (!file) throw new Error('Expected the changed readme');
  expect(file.path).toBe(session.fixture.readme.path);
  const input = {
    expectedStatusToken: changes.statusToken,
    expectedFiles: [{ path: file.path, fingerprint: file.fingerprint }],
    selections: [
      { scope: 'unstaged' as const, oldPath: file.path, newPath: file.path },
    ],
  };
  const diffs = await nativeRead(
    readChangeDiffs({ scope, connection: connected, input }),
  );
  expect(diffs.diffs).toEqual([
    {
      selection: input.selections[0],
      content: {
        kind: 'text',
        patch: await session.git('diff', '--', file.path),
      },
    },
  ]);
  await session.writeFile(file.path, 'A newer change\n');
  await expect(
    nativeRead(readChangeDiffs({ scope, connection: connected, input })),
  ).rejects.toMatchObject({
    _tag: 'WorktreeChangedError',
    message: 'Worktree changed during inspection',
  });
});

test('write the discussion through the shared owner and read each persisted edit', async ({
  server,
  session,
}) => {
  const {
    connected,
    scope,
    read: nativeRead,
    execute,
  } = await connection(server, session);
  const commands = commentCommands({ scope, connection: connected });
  const thread = await execute(commands.create, {
    anchor: { kind: 'change' },
    body: 'Explain the change.',
  });
  expect(thread.messages.map((message) => message.body)).toEqual([
    'Explain the change.',
  ]);
  const replied = await execute(commands.reply, {
    threadId: thread.id,
    body: 'Please include its test.',
    messageId: 'eb90812a-6a3e-464e-92ca-5c962094b867',
  });
  expect(replied.messages.map((message) => message.body)).toEqual([
    'Explain the change.',
    'Please include its test.',
  ]);
  await execute(commands.edit, {
    threadId: thread.id,
    messageId: 'eb90812a-6a3e-464e-92ca-5c962094b867',
    body: 'Include the regression test.',
  });
  const resolved = await execute(commands.resolve, {
    threadId: thread.id,
    resolved: true,
  });
  expect(resolved.resolved).toBe(true);
  expect(
    (await nativeRead(readCommentThreads({ scope, connection: connected })))
      .find((entry) => entry.id === thread.id)
      ?.messages.map((message) => message.body),
  ).toEqual(['Explain the change.', 'Include the regression test.']);
  expect(
    (
      await execute(commands.removeResolved, [
        { threadId: thread.id, revision: resolved.revision },
      ])
    ).deleted,
  ).toEqual([thread.id]);
  expect(
    (
      await nativeRead(readCommentThreads({ scope, connection: connected }))
    ).some((entry) => entry.id === thread.id),
  ).toBe(false);
});

for (const moved of [false, true])
  test(`write a published review discussion through the worktree owner after moving=${moved}, and read it from the review`, async ({
    server,
    session,
  }) => {
    const originalBody = await session.readFile(session.fixture.readme.path);
    const originalBranch = (
      await session.git('branch', '--show-current')
    ).trim();
    const reviewBranch = `discussion-${moved}`;
    const checkout = join(session.projectHome, 'moved-review');
    let addedWorktree = false;
    await session.git('checkout', '-b', reviewBranch);
    try {
      await commitReviewFixture(session);
      const published = await read(session, {
        method: 'PUT',
        path: worktreePath(session, '/review'),
        body: sampleReview(
          session,
          0,
          '75dc6a36-a001-4d00-b511-c45430b99403',
          '75dc6a36-a001-4d00-b511-c45430b99404',
        ),
      });
      const reviewId = text(published.reviewId);
      const {
        connected,
        scope,
        read: nativeRead,
        execute,
      } = await connection(server, session);
      let commentScope = scope;
      if (moved) {
        await session.git('checkout', '-b', 'other-work');
        await session.git('worktree', 'add', checkout, reviewBranch);
        addedWorktree = true;
        const current = Schema.decodeUnknownSync(readInventoryResponseSchema)(
          await inventory(session),
        );
        const worktree = current.projects
          .flatMap((project) => project.worktrees)
          .find((entry) => entry.path === checkout);
        if (!worktree) throw new Error('Expected the moved review worktree');
        commentScope = { ...scope, worktreeId: worktree.id };
      }
      const commands = commentCommands({
        scope: commentScope,
        connection: connected,
      });
      const thread = await execute(commands.create, {
        reviewId,
        reviewRevision: 1,
        anchor: { kind: 'change' },
        body: 'On decision 1: keep one owner.',
      });
      expect(thread.review).toMatchObject({ reviewId, revision: 1 });
      expect(
        await nativeRead(
          readCommentThreads({ scope: commentScope, connection: connected }),
        ),
      ).toContainEqual(thread);
      const target = threadWriteTarget(thread);
      const replied = await execute(commands.reply, {
        ...target,
        body: 'And name it in the route.',
      });
      const messageId = replied.messages[1]?.id ?? '';
      await execute(commands.edit, {
        ...target,
        messageId,
        body: 'And name the owner in the route.',
      });
      expect(
        (await execute(commands.resolve, { ...target, resolved: true }))
          .resolved,
      ).toBe(true);
      const stored = await nativeRead(
        readReviewComments({ connection: connected, reviewId }),
      );
      expect(
        stored.map((entry) => ({
          id: entry.id,
          resolved: entry.resolved,
          bodies: entry.messages.map((message) => message.body),
        })),
      ).toEqual([
        {
          id: thread.id,
          resolved: true,
          bodies: [
            'On decision 1: keep one owner.',
            'And name the owner in the route.',
          ],
        },
      ]);
      const removed = await execute(commands.remove, { ...target, messageId });
      expect(removed.thread?.messages.map((message) => message.body)).toEqual([
        'On decision 1: keep one owner.',
      ]);
    } finally {
      if (addedWorktree) await session.git('worktree', 'remove', checkout);
      await session.git('checkout', originalBranch);
      await session.writeFile(session.fixture.readme.path, originalBody);
    }
  });

test('mark and unmark the actual changed file through the shared reviewed owner', async ({
  server,
  session,
}) => {
  const {
    connected,
    scope,
    read: nativeRead,
    execute,
  } = await connection(server, session);
  const changes = await nativeRead(
    readChanges({ scope, connection: connected }),
  );
  const file = changes.changes[0];
  if (!file?.fingerprint)
    throw new Error('Expected the changed file fingerprint');
  const commands = reviewedCommands({
    scope,
    connection: connected,
    range: { kind: 'worktree' },
  });
  await nativeRead(readReviewedFiles({ scope, connection: connected }));
  expect(
    (
      await execute(commands.set, {
        path: file.path,
        fingerprint: file.fingerprint,
      })
    ).marks.map((mark) => mark.path),
  ).toEqual([session.fixture.readme.path]);
  expect(
    (
      await nativeRead(readReviewedFiles({ scope, connection: connected }))
    ).marks.map((mark) => mark.path),
  ).toEqual([session.fixture.readme.path]);
  expect((await execute(commands.remove, file.path)).marks).toEqual([]);
  expect(
    (await nativeRead(readReviewedFiles({ scope, connection: connected })))
      .marks,
  ).toEqual([]);
});

test('durable review clients read revisions, proof, code and comments and apply developer commands', async ({
  server,
  session,
}) => {
  await session.writeFile(
    session.fixture.readme.path,
    `${session.fixture.readme.changed}Second revision.\n`,
  );
  await commitReviewFixture(session);
  const shot = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  await session.writeFile('review-shot.png', shot);
  const published = await read(session, {
    method: 'PUT',
    path: worktreePath(session, '/review'),
    body: {
      ...sampleReview(
        session,
        1,
        '75dc6a36-a001-4d00-b511-c45430b99403',
        '75dc6a36-a001-4d00-b511-c45430b99404',
      ),
      proof: {
        checks: [{ name: 'Client integration', result: 'pass' }],
        assets: [{ kind: 'image', title: 'Shot', path: 'review-shot.png' }],
      },
    },
  });
  const reviewId = text(published.reviewId);
  const {
    connected: connectionValue,
    read: readAtom,
    execute,
    registry,
  } = await connection(server, session);
  const input = { connection: connectionValue, reviewId };
  const latest = readReview(input);
  registry.mount(latest);
  const current = await readAtom(latest);
  expect(current.review).toMatchObject({
    reviewId,
    latestRevision: 2,
    state: 'open',
    lastSeenRevision: 0,
  });
  expect(current.revisions.map((entry) => entry.revision)).toEqual([1, 2]);
  expect(
    (await readAtom(readReview({ ...input, revision: 1 }))).revision?.content
      .layers[0]?.title,
  ).toBe('Readme');
  expect(
    (
      await readAtom(
        readProjectReviews({
          connection: connectionValue,
          projectId: session.projectId,
        }),
      )
    ).map((entry) => entry.reviewId),
  ).toEqual([reviewId]);
  const file = await readAtom(
    readReviewRevisionFile({
      ...input,
      revision: 1,
      path: session.fixture.readme.path,
    }),
  );
  expect(file).toMatchObject({
    kind: 'text',
    text: session.fixture.readme.changed,
  });
  const diffs = await readAtom(
    readReviewRevisionDiffs({
      ...input,
      revision: 1,
      paths: [[session.fixture.readme.path]],
    }),
  );
  const patch = diffs.diffs[0]?.content;
  if (patch?.kind !== 'text')
    throw new Error('Expected the retained revision patch');
  expect(patch.patch).toContain('+A change to review.');
  const proofId = current.revision?.content.proof.assets[0]?.id ?? '';
  expect(
    await readAtom(readReviewRevisionProof({ ...input, revision: 2, proofId })),
  ).toMatchObject({
    mediaType: 'image/png',
    base64: Buffer.from(shot).toString('base64'),
  });
  const commands = reviewCommands(input);
  await execute(commands.seen, 1);
  expect((await readAtom(latest)).review?.lastSeenRevision).toBe(1);
  const headFile = await readAtom(
    readReviewRevisionFile({
      ...input,
      revision: 2,
      path: session.fixture.readme.path,
    }),
  );
  if (headFile.kind !== 'text')
    throw new Error('Expected text at the review head');
  await execute(commands.mark, {
    kind: 'file',
    revision: 2,
    path: session.fixture.readme.path,
    headBlobOid: headFile.blobOid,
  });
  const layer = current.revision?.content.layers[0];
  if (layer === undefined) throw new Error('Expected the stored decision');
  await execute(commands.mark, {
    kind: 'decision',
    revision: 2,
    layerId: layer.id,
    fingerprint: layer.fingerprint,
  });
  const marks = readReviewMarks(input);
  registry.mount(marks);
  expect(await readAtom(marks)).toMatchObject({
    files: [
      { path: session.fixture.readme.path, fingerprint: headFile.blobOid },
    ],
    decisions: [{ layerId: layer.id, fingerprint: layer.fingerprint }],
  });
  await execute(commands.unmark, {
    kind: 'file',
    path: session.fixture.readme.path,
    headBlobOid: headFile.blobOid,
  });
  await execute(commands.unmark, {
    kind: 'decision',
    layerId: layer.id,
    fingerprint: layer.fingerprint,
  });
  expect(await readAtom(marks)).toEqual({ files: [], decisions: [] });
  const comments = readReviewComments(input);
  registry.mount(comments);
  expect(await readAtom(comments)).toEqual([]);
  const thread = await execute(commands.createComment, {
    reviewRevision: 1,
    anchor: { kind: 'file', filePath: session.fixture.readme.path },
    body: 'Review revision one.',
  });
  expect(thread.review).toEqual({
    reviewId,
    revision: 1,
    headOid: current.revisions[0]?.headOid,
  });
  const reply = await execute(commands.reply, {
    threadId: thread.id,
    body: 'Reply.',
  });
  const messageId = reply.messages[1]?.id ?? '';
  await execute(commands.edit, {
    threadId: thread.id,
    messageId,
    body: 'Edited reply.',
  });
  expect(
    (await readAtom(comments))[0]?.messages.map((entry) => entry.body),
  ).toEqual(['Review revision one.', 'Edited reply.']);
  await execute(commands.deleteComment, { threadId: thread.id, messageId });
  const resolved = await execute(commands.resolve, {
    threadId: thread.id,
    resolved: true,
  });
  expect(
    await execute(commands.deleteResolved, {
      threads: [{ threadId: thread.id, revision: resolved.revision }],
    }),
  ).toEqual({ deleted: [thread.id], skipped: [] });
  expect(await readAtom(comments)).toEqual([]);
  await execute(commands.close, undefined);
  expect((await readAtom(latest)).review?.state).toBe('closed');
  expect(await execute(commands.remove, undefined)).toEqual({ deleted: true });
});
