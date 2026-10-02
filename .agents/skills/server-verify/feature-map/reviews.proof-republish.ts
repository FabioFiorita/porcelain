import { randomUUID } from 'node:crypto';
import {
  apiError,
  defineCase,
  defineFeature,
  invalidRequest,
  unknownUuid,
} from '../scripts/feature.ts';
import {
  list,
  record,
  type Session,
} from '../../../../apps/server/spec/kit/session.ts';
import {
  read,
  sampleReview,
} from '../../../../apps/server/spec/kit/requests.ts';
import { worktreePath } from '../scripts/fixture.ts';

const layerId = randomUUID();
const stepId = randomUUID();
const shotPath = 'republish-shot.png';
const shot = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

const publish = (
  session: Session,
  expectedRevision: number,
  assets: unknown,
) => ({
  method: 'PUT' as const,
  path: worktreePath(session, '/review'),
  body: {
    ...sampleReview(session, expectedRevision, layerId, stepId),
    proof: { assets },
  },
});
const proofFile = (session: Session, proofId: string) => ({
  method: 'GET' as const,
  path: `${worktreePath(session, '/review/proof')}?proofId=${proofId}`,
});
const firstAsset = (body: unknown) =>
  record(list(record(record(record(body).review).proof).assets)[0]);
const publishedId = async (session: Session) =>
  String(
    firstAsset(
      await read(session, {
        method: 'GET',
        path: worktreePath(session, '/review'),
      }),
    ).id,
  );

export default defineFeature({
  feature: 'reviews.proof-republish',
  reaches: [
    'PUT /api/worktrees/:worktreeId/review',
    'GET /api/worktrees/:worktreeId/review/proof',
  ],
  paired: true,
  intent: 'intended',
  behaviour:
    'A publisher that republishes keeps an image or video it already published by naming its proof id instead of a path: the server copies the kept file into the new review under a new id, even after the worktree file is gone. A proof id the current review does not hold, or an asset naming both a path and a proof id, is refused and changes nothing.',
  cases: [
    defineCase({
      name: 'publish a screenshot',
      async setup(session) {
        await session.writeFile(shotPath, shot);
      },
      request: (session) =>
        publish(session, 0, [{ kind: 'image', title: 'Shot', path: shotPath }]),
      expect({ response, check, checkPartial }) {
        check('status', 200, response.status);
        checkPartial(
          'the screenshot is kept',
          {
            kind: 'image',
            mediaType: 'image/png',
            byteLength: shot.byteLength,
          },
          firstAsset(response.body),
        );
      },
    }),
    defineCase({
      name: 'delete the file and republish keeping it by its proof id',
      async setup(session) {
        await session.remove(shotPath);
        return publishedId(session);
      },
      request: (session, proofId) =>
        publish(session, 1, [
          { kind: 'image', title: 'Same shot', proofId, layerId },
        ]),
      expect({ response, state, check, checkPartial, checkDiffers }) {
        check('status', 200, response.status);
        const kept = firstAsset(response.body);
        checkPartial(
          'the kept screenshot',
          {
            kind: 'image',
            title: 'Same shot',
            mediaType: 'image/png',
            byteLength: shot.byteLength,
            layerId,
          },
          kept,
        );
        checkDiffers('under a new id', state, kept.id);
      },
    }),
    defineCase({
      name: 'read the kept screenshot',
      setup: publishedId,
      request: (session, proofId) => proofFile(session, proofId),
      expect({ response, state, check }) {
        check('status', 200, response.status);
        check(
          'the bytes first published',
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
      name: 'refused keeps change nothing',
      setup: publishedId,
      request: (session, proofId) => [
        publish(session, 2, [
          { kind: 'image', title: 'Shot', proofId: unknownUuid },
        ]),
        publish(session, 2, [
          { kind: 'image', title: 'Shot', proofId, path: shotPath },
        ]),
        publish(session, 2, [{ kind: 'image', title: 'Shot' }]),
      ],
      async expect({ responses, session, state, check }) {
        check('unknown proof id status', 400, responses[0]?.status);
        check(
          'unknown proof id error body',
          apiError(
            400,
            'Bad Request',
            'A proofId names no image or video of the current review',
          ),
          responses[0]?.body,
        );
        check('path and proof id status', 400, responses[1]?.status);
        check(
          'path and proof id error body',
          invalidRequest,
          responses[1]?.body,
        );
        check('neither status', 400, responses[2]?.status);
        check('neither error body', invalidRequest, responses[2]?.body);
        check('the kept file is unchanged', state, await publishedId(session));
      },
    }),
  ],
});
