import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import {
  commitReviewFixture,
  lineCount,
  read,
  sampleReview,
  toolCall,
  toolValue,
  worktreePath,
} from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { list, record, text } from '../kit/session.ts';

const layersOf = (body: unknown) => list(record(body).layers);
const contentOf = (body: unknown) => record(record(body).revision).content;

test('code moved is live per decision while published code stays unchanged', async ({
  session,
}) => {
  await commitReviewFixture(session);
  const draft = sampleReview(session, 0, randomUUID(), randomUUID());
  const layer = draft.layers[0];
  if (layer === undefined) throw new Error('The fixture has no decision');
  const step = layer.steps[0];
  if (step === undefined) throw new Error('The fixture has no step');
  const published = await read(session, {
    method: 'PUT',
    path: worktreePath(session, '/review'),
    body: {
      ...draft,
      layers: [
        layer,
        {
          ...layer,
          id: randomUUID(),
          title: 'Unchanged introduction',
          steps: [
            {
              ...step,
              id: randomUUID(),
              kind: 'context',
              pointer: { ...step.pointer, startLine: 1, endLine: 1 },
            },
          ],
        },
      ],
    },
  });
  const reviewId = text(record(published.review).reviewId);
  const path = `/api/reviews/${reviewId}`;
  const before = contentOf(await read(session, { method: 'GET', path }));
  expect(layersOf(before).map((value) => record(value).codeMoved)).toEqual([
    false,
    false,
  ]);
  await session.writeFile(
    session.fixture.readme.path,
    `${session.fixture.readme.committed}Changed after the explanation.\n`,
  );
  const after = contentOf(await read(session, { method: 'GET', path }));
  expect(layersOf(after)).toEqual([
    { ...record(layersOf(before)[0]), codeMoved: true },
    record(layersOf(before)[1]),
  ]);
  const branch = await read(session, {
    method: 'GET',
    path: worktreePath(session, '/review'),
  });
  expect(
    layersOf(branch.review).map((value) => record(value).codeMoved),
  ).toEqual([true, false]);
  const mcp = toolValue(
    await read(session, toolCall(session, 1, 'read_review', { reviewId })),
  );
  expect(layersOf(contentOf(mcp))).toEqual(layersOf(after));
  expect(
    await read(session, {
      method: 'GET',
      path: `${path}/revisions/1/file`,
      query: { path: session.fixture.readme.path },
    }),
  ).toMatchObject({ kind: 'text', text: session.fixture.readme.changed });
  await session.remove(session.fixture.readme.path);
  expect(
    layersOf(contentOf(await read(session, { method: 'GET', path }))).map(
      (value) => record(value).codeMoved,
    ),
  ).toEqual([true, true]);
  await session.writeFile(
    session.fixture.readme.path,
    session.fixture.readme.changed,
  );
  expect(
    layersOf(contentOf(await read(session, { method: 'GET', path }))).map(
      (value) => record(value).codeMoved,
    ),
  ).toEqual([false, false]);
});

test('whole-file anchors compare only the latest revision on its published branch', async ({
  session,
}) => {
  await session.writeFile(
    session.fixture.readme.path,
    session.fixture.readme.changed,
  );
  const draft = sampleReview(session, 1, randomUUID(), randomUUID());
  const layer = draft.layers[0];
  if (layer === undefined) throw new Error('The fixture has no decision');
  const step = layer.steps[0];
  if (step === undefined) throw new Error('The fixture has no step');
  const published = await read(session, {
    method: 'PUT',
    path: worktreePath(session, '/review'),
    body: {
      ...draft,
      layers: [
        {
          ...layer,
          steps: [
            {
              ...step,
              pointer: {
                ...step.pointer,
                startLine: 1,
                endLine: lineCount(session.fixture.readme.changed),
              },
            },
          ],
        },
      ],
    },
  });
  const path = `/api/reviews/${text(record(published.review).reviewId)}`;
  await session.writeFile(
    session.fixture.readme.path,
    `Edited introduction.\n${session.fixture.readme.changed.split('\n').slice(1).join('\n')}`,
  );
  expect(
    layersOf(contentOf(await read(session, { method: 'GET', path }))),
  ).toMatchObject([{ codeMoved: true }]);
  expect(
    layersOf(
      contentOf(
        await read(session, { method: 'GET', path: `${path}/revisions/1` }),
      ),
    )[0],
  ).not.toHaveProperty('codeMoved');
  await session.git('switch', '-c', 'other-code-moved-branch');
  expect(
    layersOf(contentOf(await read(session, { method: 'GET', path })))[0],
  ).not.toHaveProperty('codeMoved');
});
