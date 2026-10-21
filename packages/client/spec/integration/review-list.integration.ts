import { expect } from 'vitest';
import { test } from '@porcelain/server/kit/server-test';
import {
  read,
  sampleReview,
  commitReviewFixture,
  worktreePath,
} from '@porcelain/server/kit/requests';
import {
  readReviewList,
  readReviewMarks,
  readReview,
  reviewCommands,
} from '@porcelain/client/reviews';
import { refreshInventory } from '@porcelain/client/projects';
import { connection } from '../kit/connection.ts';

test('a durable review appears once, follows current decision marks and closure, and leaves its checkout reachable', async ({
  server,
  session,
}) => {
  await commitReviewFixture(session);
  await read(session, {
    method: 'PUT',
    path: worktreePath(session, '/review'),
    body: sampleReview(
      session,
      0,
      '75dc6a36-a001-4d00-b511-c45430b99403',
      '75dc6a36-a001-4d00-b511-c45430b99404',
    ),
  });
  const {
    connected,
    registry,
    execute,
    read: nativeRead,
  } = await connection(server, session);
  const list = readReviewList([connected]);
  const stop = registry.mount(list);
  try {
    await expect.poll(() => registry.get(list).loading).toBe(false);
    const row = registry
      .get(list)
      .entries.find((entry) => entry.reviewId !== undefined);
    expect(row).toMatchObject({
      title: 'Verify the disposable README review',
      group: 'Needs you',
      reviewed: 0,
      total: 1,
      closed: false,
      worktreeId: session.worktreeId,
    });
    if (!row?.reviewId) throw new Error('Missing published review');
    expect(
      registry
        .get(list)
        .entries.filter((entry) => entry.worktreeId === session.worktreeId),
    ).toHaveLength(1);
    const review = await nativeRead(
      readReview({ connection: connected, reviewId: row.reviewId }),
    );
    const result = await nativeRead(
      readReviewMarks({ connection: connected, reviewId: row.reviewId }),
    );
    expect(result.decisions).toEqual([]);
    const layer = review.revision?.content.layers[0];
    if (!layer) throw new Error('Publication omitted layers');
    const commands = reviewCommands({
      connection: connected,
      reviewId: row.reviewId,
    });
    await execute(commands.mark, {
      kind: 'decision',
      revision: 1,
      layerId: layer.id,
      fingerprint: layer.fingerprint,
    });
    await execute(refreshInventory(connected), undefined);
    await expect
      .poll(
        () =>
          registry
            .get(list)
            .entries.find((entry) => entry.reviewId === row.reviewId)?.group,
      )
      .toBe('Ready to merge');
    expect(
      registry
        .get(list)
        .entries.find((entry) => entry.reviewId === row.reviewId)?.reviewed,
    ).toBe(1);
    await execute(commands.close, undefined);
    await execute(refreshInventory(connected), undefined);
    await expect
      .poll(
        () =>
          registry
            .get(list)
            .entries.find((entry) => entry.reviewId === row.reviewId)?.closed,
      )
      .toBe(true);
    expect(
      registry.get(list).entries.find((entry) => entry.group === 'No review'),
    ).toMatchObject({ worktreeId: session.worktreeId, disabled: false });
    expect(review).toHaveProperty('review');
  } finally {
    stop();
  }
});
