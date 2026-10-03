import { listCommitModelsResponseSchema } from '@porcelain/contracts/git-actions';
import { expect } from 'vitest';
import { unauthenticated } from '../kit/answers.ts';
import { test } from '../kit/server-test.ts';

test('listing commit models with no model tool on the path answers an empty list', async ({
  session,
}) => {
  const response = await session.send({
    method: 'GET',
    path: '/api/git/commit-models',
  });

  expect(response.status).toBe(200);
  expect(response.body).toStrictEqual([]);
  expect(response.body).toEqual(
    expect.schemaMatching(listCommitModelsResponseSchema),
  );
});

test('listing commit models once the Claude command-line tool is installed answers the Claude models', async ({
  session,
}) => {
  await session.installCodingTool();

  const response = await session.send({
    method: 'GET',
    path: '/api/git/commit-models',
  });

  expect(response.status).toBe(200);
  expect(response.body).toStrictEqual([
    { id: 'claude:sonnet', label: 'Sonnet' },
    { id: 'claude:haiku', label: 'Haiku' },
  ]);
  expect(response.body).toEqual(
    expect.schemaMatching(listCommitModelsResponseSchema),
  );
});

test('listing commit models without a credential is refused as unauthenticated', async ({
  session,
}) => {
  const response = await session.send({
    method: 'GET',
    path: '/api/git/commit-models',
    auth: 'none',
  });

  expect(response.status).toBe(401);
  expect(response.body).toStrictEqual(unauthenticated);
});
