import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import {
  commitReviewFixture,
  read,
  sampleReview,
  toolCall,
  toolValue,
} from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { record, text } from '../kit/session.ts';

test('MCP publication retains exact pointer coverage across revisions', async ({
  session,
}) => {
  await session.git('branch', 'porcelain-fixture-base');
  await session.writeFile(
    session.fixture.readme.path,
    session.fixture.readme.committed,
  );
  await session.writeFile(
    'coverage.ts',
    'const explained = 1;\nconst unmentioned = 2;\n',
  );
  await commitReviewFixture(session);
  const draft = sampleReview(session, 0, randomUUID(), randomUUID(), {
    path: 'coverage.ts',
  });
  const pointer = draft.layers[0]?.steps[0]?.pointer;
  if (!pointer) throw new Error('Sample review has no pointer');
  pointer.startLine = 1;
  pointer.endLine = 1;
  const first = record(
    toolValue(
      await read(session, toolCall(session, 1, 'publish_review', draft)),
    ),
  );
  const reviewId = text(first.reviewId);
  const revisionPath = `/api/reviews/${reviewId}/revisions`;
  const single = await read(session, {
    method: 'GET',
    path: `${revisionPath}/1`,
  });
  expect(record(record(single.revision).content).notExplained).toEqual([
    { path: 'coverage.ts', ranges: [{ startLine: 2, endLine: 2 }] },
  ]);
  pointer.endLine = 2;
  const second = record(
    toolValue(
      await read(
        session,
        toolCall(session, 2, 'publish_review', {
          ...draft,
          expectedRevision: 1,
        }),
      ),
    ),
  );
  expect(second).toMatchObject({ reviewId, revision: 2 });
  const whole = await read(session, {
    method: 'GET',
    path: `${revisionPath}/2`,
  });
  expect(record(record(whole.revision).content).notExplained).toEqual([]);
  const retained = await read(session, {
    method: 'GET',
    path: `${revisionPath}/1`,
  });
  expect(record(record(retained.revision).content).notExplained).toEqual([
    { path: 'coverage.ts', ranges: [{ startLine: 2, endLine: 2 }] },
  ]);
});
