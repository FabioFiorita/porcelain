import * as Schema from 'effect/Schema';
import { randomUUID } from 'node:crypto';
import {
  publishReviewResponseSchema,
  readProofFileResponseSchema,
} from '@porcelain/contracts/reviews';
import { expect } from 'vitest';
import {
  apiError,
  invalidRequest,
  UNKNOWN_UUID,
  unknownWorktreeId,
  worktreeNotFound,
} from '../kit/answers.ts';
import { read, sampleReview, worktreePath } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { list, record, type Session } from '../kit/session.ts';

const layerId = randomUUID();
const stepId = randomUUID();
const SHOT_PATH = 'proof-shot.png';
const DISGUISED_PATH = 'proof-disguised.png';
const shot = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);
const disguised = new TextEncoder().encode(
  '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>',
);
const checks = [
  { name: 'pnpm test', result: 'pass' },
  {
    name: 'Save journey',
    result: 'fail',
    output: 'Expected the Saved notice',
    layerId,
    stepId,
  },
];
const link = {
  kind: 'link',
  title: 'CI run',
  url: 'https://ci.example/runs/1',
};

const publish = (session: Session, body: unknown) => ({
  method: 'PUT' as const,
  path: worktreePath(session, '/review'),
  body,
});
const withProof = (
  session: Session,
  expectedRevision: number,
  proof: unknown,
) => ({ ...sampleReview(session, expectedRevision, layerId, stepId), proof });
const proofFile = (proofId: string, worktreeId?: string) => ({
  method: 'GET' as const,
  path: `/api/worktrees/${worktreeId ?? ''}/review/proof?proofId=${proofId}`,
});
const currentReview = async (session: Session) =>
  record(
    (
      await read(session, {
        method: 'GET',
        path: worktreePath(session, '/review'),
      })
    ).review,
  );
const firstAssetId = async (session: Session) =>
  String(
    record(list(record((await currentReview(session)).proof).assets)[0]).id,
  );

test('publishing checks, a screenshot and a link keeps the screenshot as a PNG of its size under its own id', async ({
  session,
}) => {
  await session.writeFile(SHOT_PATH, shot);

  const response = await session.send(
    publish(
      session,
      withProof(session, 0, {
        checks,
        assets: [
          { kind: 'image', title: 'Saved notice', path: SHOT_PATH, layerId },
          link,
        ],
      }),
    ),
  );

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(Schema.toEncoded(publishReviewResponseSchema)),
    ),
  );
  const proof = record(record(record(response.body).review).proof);
  expect(proof.checks).toStrictEqual(checks);
  expect(proof.assets).toMatchObject([
    {
      kind: 'image',
      title: 'Saved notice',
      mediaType: 'image/png',
      byteLength: shot.byteLength,
      layerId,
    },
    link,
  ]);
  expect(record(list(proof.assets)[0]).id).toMatch(/^[0-9a-f-]{36}$/);
});

test('a reviewer reads a kept screenshot by its id as the published bytes', async ({
  session,
}) => {
  const proofId = await firstAssetId(session);

  const response = await session.send(proofFile(proofId, session.worktreeId));

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(Schema.toEncoded(readProofFileResponseSchema)),
    ),
  );
  expect(response.body).toStrictEqual({
    id: proofId,
    mediaType: 'image/png',
    base64: Buffer.from(shot).toString('base64'),
  });
});

test('proof that is not its kind, is missing, names an unknown layer or step, or links outside http is refused and changes nothing', async ({
  session,
}) => {
  await session.writeFile(DISGUISED_PATH, disguised);
  const before = await currentReview(session);

  const responses = [];
  for (const proof of [
    { assets: [{ kind: 'image', title: 'Shot', path: DISGUISED_PATH }] },
    { assets: [{ kind: 'video', title: 'Run', path: SHOT_PATH }] },
    { assets: [{ kind: 'image', title: 'Gone', path: 'proof-gone.png' }] },
    { checks: [{ name: 'Tests', result: 'pass', layerId: UNKNOWN_UUID }] },
    { checks: [{ name: 'Tests', result: 'pass', stepId }] },
    { assets: [{ ...link, url: 'javascript:alert(1)' }] },
  ])
    responses.push(
      await session.send(publish(session, withProof(session, 1, proof))),
    );

  const notItsKind = apiError(
    422,
    'Unprocessable Entity',
    'A proof file is not the kind it names: an image must be PNG, JPEG, GIF or WebP and a video MP4 or WebM',
  );
  const unknownTarget = apiError(
    400,
    'Bad Request',
    'A check or asset names a layer or step the review does not have; a step also needs its layer',
  );
  expect(responses.map((response) => response.status)).toStrictEqual([
    422, 422, 422, 400, 400, 400,
  ]);
  expect(responses.map((response) => response.body)).toStrictEqual([
    notItsKind,
    notItsKind,
    apiError(
      422,
      'Unprocessable Entity',
      'A proof file is missing from the worktree or is not a readable file',
    ),
    unknownTarget,
    unknownTarget,
    invalidRequest,
  ]);
  const after = await currentReview(session);
  expect(after.revision).toStrictEqual(before.revision);
  expect(after.proof).toStrictEqual(before.proof);
});

test('publishing again without proof drops the kept files', async ({
  session,
}) => {
  const proofId = await firstAssetId(session);

  const published = await session.send(
    publish(session, sampleReview(session, 1, layerId, stepId)),
  );
  const oldFile = await session.send(proofFile(proofId, session.worktreeId));

  expect(published.status).toBe(200);
  expect(published.body).toMatchObject({
    review: { revision: 2, proof: { checks: [], assets: [] } },
  });
  expect(oldFile.status).toBe(404);
  expect(oldFile.body).toStrictEqual(
    apiError(404, 'Not Found', 'Proof file not found'),
  );
});

test('reading a proof file with a malformed id is invalid and in an unknown worktree is not found', async ({
  session,
}) => {
  const malformed = await session.send(proofFile('shot', session.worktreeId));
  const unknown = await session.send(
    proofFile(UNKNOWN_UUID, unknownWorktreeId),
  );

  expect(malformed.status).toBe(400);
  expect(malformed.body).toStrictEqual(invalidRequest);
  expect(unknown.status).toBe(404);
  expect(unknown.body).toStrictEqual(worktreeNotFound);
});
