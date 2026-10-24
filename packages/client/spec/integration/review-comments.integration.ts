import { join } from 'node:path';
import { Schema } from 'effect';
import { expect } from 'vitest';
import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import {
  commentCommands,
  readCommentThreads,
  readReviewComments,
} from '@porcelain/client/reviews';
import { threadWriteTarget } from '@porcelain/client/reviews/rules';
import { text } from '@porcelain/server/kit/session';
import { test } from '@porcelain/server/kit/server-test';
import {
  read,
  sampleReview,
  commitReviewFixture,
  worktreePath,
} from '@porcelain/server/kit/requests';
import { connection } from '../kit/connection.ts';

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
      await session.writeFile(
        session.fixture.readme.path,
        session.fixture.readme.changed,
      );
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
          await read(session, {
            method: 'POST',
            path: '/api/inventory/refresh',
          }),
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
      const reader = await connection(server, session);
      expect(
        await reader.read(
          readCommentThreads({
            scope: commentScope,
            connection: reader.connected,
          }),
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
