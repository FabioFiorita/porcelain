import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import { test } from '../kit/server-test.ts';
import {
  commitReviewFixture,
  read,
  sampleReview,
  toolCall,
  toolValue,
} from '../kit/requests.ts';
import { list, record, text } from '../kit/session.ts';

test('retains removal marks across republishing, rejects foreign fingerprints, and unmarks the exact blob', async ({
  session,
}) => {
  await commitReviewFixture(session);
  await session.writeFile('retired.ts', 'export const retired = true;\n');
  await session.git('add', 'retired.ts');
  await session.git('commit', '-m', 'Prepare retired code');
  await session.git('branch', 'removal-base');
  const oldOid = (await session.git('rev-parse', 'HEAD:retired.ts')).trim();
  await session.remove('retired.ts');
  await session.writeFile(
    'README.md',
    `${session.fixture.readme.changed}Removal explained.\n`,
  );
  await commitReviewFixture(session);
  const layerId = randomUUID();
  const draft = {
    ...sampleReview(session, 0, layerId, randomUUID()),
    base: 'refs/heads/removal-base',
    verdict: {
      ...sampleReview(session, 0, layerId, randomUUID()).verdict,
      removed: [
        {
          behavior: 'Retired code',
          why: 'The replacement owns this behavior',
          paths: ['retired.ts'],
        },
      ],
    },
  };
  const first = record(
    toolValue(
      await read(session, toolCall(session, 1, 'publish_review', draft)),
    ),
  );
  const reviewId = text(first.reviewId);
  const url = `/api/reviews/${reviewId}`;
  const revision = record(
    (await read(session, { method: 'GET', path: `${url}/revisions/1` }))
      .revision,
  );
  expect(list(revision.files)).toContainEqual(
    expect.objectContaining({ path: 'retired.ts', status: 'deleted', oldOid }),
  );
  const mark = {
    kind: 'file',
    revision: 1,
    path: 'retired.ts',
    headBlobOid: oldOid,
  };
  for (const body of [
    { ...mark, headBlobOid: 'f'.repeat(40) },
    { ...mark, path: 'not-in-review.ts' },
  ])
    await read(session, { method: 'PUT', path: `${url}/marks`, body }, 409);
  expect(await read(session, { method: 'GET', path: `${url}/marks` })).toEqual({
    files: [],
    decisions: [],
  });
  expect(
    await read(session, { method: 'PUT', path: `${url}/marks`, body: mark }),
  ).toEqual({ updated: true });
  const content = record(revision.content);
  const layer = record(list(content.layers)[0]);
  await read(session, {
    method: 'PUT',
    path: `${url}/marks`,
    body: {
      kind: 'decision',
      revision: 1,
      layerId,
      fingerprint: text(layer.fingerprint),
    },
  });
  await session.writeFile('retired.ts', 'export const retired = false;\n');
  await commitReviewFixture(session);
  await read(
    session,
    toolCall(session, 2, 'publish_review', { ...draft, expectedRevision: 1 }),
  );
  expect(
    await read(session, { method: 'PUT', path: `${url}/marks`, body: mark }),
  ).toEqual({ updated: true });
  await read(
    session,
    { method: 'PUT', path: `${url}/marks`, body: { ...mark, revision: 2 } },
    409,
  );
  expect(
    await read(session, { method: 'GET', path: `${url}/marks` }),
  ).toMatchObject({
    files: [{ path: 'retired.ts', fingerprint: oldOid }],
    decisions: [{ layerId }],
  });
  await read(session, {
    method: 'POST',
    path: `${url}/marks/removal`,
    body: { kind: 'file', path: 'retired.ts', headBlobOid: 'f'.repeat(40) },
  });
  expect(
    (await read(session, { method: 'GET', path: `${url}/marks` })).files,
  ).toHaveLength(1);
  await read(session, {
    method: 'POST',
    path: `${url}/marks/removal`,
    body: { kind: 'file', path: 'retired.ts', headBlobOid: oldOid },
  });
  expect(
    await read(session, { method: 'GET', path: `${url}/marks` }),
  ).toMatchObject({ files: [], decisions: [{ layerId }] });
});
