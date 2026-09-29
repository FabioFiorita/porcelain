import { randomUUID } from 'node:crypto';
import {
  publishReviewResponseSchema,
  readProofFileResponseSchema,
} from '@porcelain/contracts/reviews';
import {
  apiError,
  defineCase,
  defineFeature,
  invalidRequest,
  list,
  record,
  unknownUuid,
  unknownWorktreeId,
  type Session,
} from '../scripts/feature.ts';
import {
  read,
  sampleReview,
  worktreeNotFound,
  worktreePath,
} from '../scripts/fixture.ts';

const layerId = randomUUID();
const stepId = randomUUID();
const shotPath = 'proof-shot.png';
const disguisedPath = 'proof-disguised.png';
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

export default defineFeature({
  feature: 'reviews.proof',
  reaches: [
    'PUT /api/worktrees/:worktreeId/review',
    'GET /api/worktrees/:worktreeId/review/proof',
  ],
  paired: true,
  intent: 'intended',
  behaviour:
    'A publisher attaches proof to the review: checks with a pass, fail or skipped result and optional short output, and assets, each optionally on a layer or one of its steps. An image or video asset names a worktree file; the server reads it at publish, accepts it only when its bytes are a PNG, JPEG, GIF or WebP image or an MP4 or WebM video matching the kind it names, keeps its own copy under a new id and answers the media type and size; a link keeps its http or https address. The published review carries the proof, and a reviewer reads a kept file by its id as base64 with its media type. Proof on a layer or step the review does not have, a missing file and a file whose bytes are not its kind are refused and change nothing; publishing again replaces the proof and its files.',
  cases: [
    defineCase({
      name: 'publish checks, a screenshot and a link',
      async setup(session) {
        await session.writeFile(shotPath, shot);
      },
      request: (session) =>
        publish(
          session,
          withProof(session, 0, {
            checks,
            assets: [
              { kind: 'image', title: 'Saved notice', path: shotPath, layerId },
              link,
            ],
          }),
        ),
      expect({ response, check, checkContract, checkPartial, checkMatch }) {
        check('status', 200, response.status);
        checkContract('contract', publishReviewResponseSchema, response.body);
        const proof = record(record(record(response.body).review).proof);
        check('checks as published', checks, proof.checks);
        checkPartial(
          'the screenshot is kept as a PNG of its size, and the link as given',
          [
            {
              kind: 'image',
              title: 'Saved notice',
              mediaType: 'image/png',
              byteLength: shot.byteLength,
              layerId,
            },
            link,
          ],
          proof.assets,
        );
        checkMatch(
          'the screenshot has its own id',
          /^[0-9a-f-]{36}$/,
          record(list(proof.assets)[0]).id,
        );
      },
    }),
    defineCase({
      name: 'read the kept screenshot',
      setup: firstAssetId,
      request: (session, proofId) => proofFile(proofId, session.worktreeId),
      expect({ response, state, check, checkContract }) {
        check('status', 200, response.status);
        checkContract('contract', readProofFileResponseSchema, response.body);
        check(
          'the bytes that were published',
          {
            id: state,
            mediaType: 'image/png',
            base64: Buffer.from(shot).toString('base64'),
          },
          response.body,
        );
      },
    }),
    defineCase({
      name: 'refused proof changes nothing',
      async setup(session) {
        await session.writeFile(disguisedPath, disguised);
        return currentReview(session);
      },
      request: (session) => [
        publish(
          session,
          withProof(session, 1, {
            assets: [{ kind: 'image', title: 'Shot', path: disguisedPath }],
          }),
        ),
        publish(
          session,
          withProof(session, 1, {
            assets: [{ kind: 'video', title: 'Run', path: shotPath }],
          }),
        ),
        publish(
          session,
          withProof(session, 1, {
            assets: [{ kind: 'image', title: 'Gone', path: 'proof-gone.png' }],
          }),
        ),
        publish(
          session,
          withProof(session, 1, {
            checks: [{ name: 'Tests', result: 'pass', layerId: unknownUuid }],
          }),
        ),
        publish(
          session,
          withProof(session, 1, {
            checks: [{ name: 'Tests', result: 'pass', stepId }],
          }),
        ),
        publish(
          session,
          withProof(session, 1, {
            assets: [{ ...link, url: 'javascript:alert(1)' }],
          }),
        ),
      ],
      async expect({ responses, session, state, check }) {
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
        const expected = [
          ['an SVG named as an image', 422, notItsKind],
          ['a PNG named as a video', 422, notItsKind],
          [
            'a missing file',
            422,
            apiError(
              422,
              'Unprocessable Entity',
              'A proof file is missing from the worktree or is not a readable file',
            ),
          ],
          ['a check on an unknown layer', 400, unknownTarget],
          ['a check on a step without its layer', 400, unknownTarget],
          ['a link that is not http or https', 400, invalidRequest],
        ] as const;
        for (const [index, [name, status, body]] of expected.entries()) {
          check(`${name} status`, status, responses[index]?.status);
          check(`${name} error body`, body, responses[index]?.body);
        }
        const after = await currentReview(session);
        check('the revision is unchanged', state.revision, after.revision);
        check('the proof is unchanged', state.proof, after.proof);
      },
    }),
    defineCase({
      name: 'publishing again without proof drops the kept files',
      setup: firstAssetId,
      request: (session, proofId) => [
        publish(session, sampleReview(session, 1, layerId, stepId)),
        proofFile(proofId, session.worktreeId),
      ],
      expect({ responses, check, checkPartial }) {
        check('publish status', 200, responses[0]?.status);
        checkPartial(
          'the review carries no proof',
          { review: { revision: 2, proof: { checks: [], assets: [] } } },
          responses[0]?.body,
        );
        check('the old file status', 404, responses[1]?.status);
        check(
          'the old file is gone',
          apiError(404, 'Not Found', 'Proof file not found'),
          responses[1]?.body,
        );
      },
    }),
    defineCase({
      name: 'a malformed proof id or an unknown worktree',
      request: (session) => [
        proofFile('shot', session.worktreeId),
        proofFile(unknownUuid, unknownWorktreeId),
      ],
      expect({ responses, check }) {
        check('malformed id status', 400, responses[0]?.status);
        check('malformed id error body', invalidRequest, responses[0]?.body);
        check('unknown worktree status', 404, responses[1]?.status);
        check(
          'unknown worktree error body',
          worktreeNotFound,
          responses[1]?.body,
        );
      },
    }),
  ],
});
