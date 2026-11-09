import { Schema } from 'effect';
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/http-api';
import {
  walkthroughRunSchema as domainRunSchema,
  walkthroughContentSchema as domainContentSchema,
  writerSchema,
} from '@porcelain/walkthroughs/models';
import {
  WalkthroughFailedError,
  WalkthroughAssetNotFoundError,
} from '@porcelain/walkthroughs/errors';
import { nullableAsUndefined } from '../shared/schema.ts';
import { porcelainApi } from '../shared/http-api.ts';
import { PairedRequest } from '../shared/http-caller.ts';
import { worktreeParamsSchema } from '../shared/worktree-params.ts';
import { worktreeFailures } from '../shared/worktree-failures.ts';
import { gitReadFailures } from '../shared/git-read-failures.ts';
import { httpFailure } from '../shared/http-failure.ts';
export const walkthroughContentSchema = Schema.Struct({
  ...domainContentSchema.fields,
  checks: nullableAsUndefined(Schema.String),
  stops: Schema.Array(
    Schema.Struct({
      ...domainContentSchema.fields.stops.value.fields,
      attention: nullableAsUndefined(
        Schema.Struct({
          kind: Schema.Literals([
            'tradeoff',
            'contract',
            'product',
            'risk',
            'accessibility',
          ]),
          note: Schema.String,
          question: Schema.String,
        }),
      ),
    }),
  ),
});
const readySchema = Schema.Struct({
  status: Schema.Literal('ready'),
  content: walkthroughContentSchema,
  writtenAt: Schema.String,
  durationMs: Schema.Number,
  costUsd: nullableAsUndefined(Schema.Number),
});
const walkthroughRunSchema = Schema.Struct({
  ...domainRunSchema.fields,
  pullRequestNumber: nullableAsUndefined(Schema.Int),
  sessionId: nullableAsUndefined(Schema.String),
  state: Schema.Union([
    Schema.Struct({ status: Schema.Literal('queued') }),
    Schema.Struct({ status: Schema.Literal('running') }),
    readySchema,
    domainRunSchema.fields.state.members[3],
  ]),
});
const walkthroughAssetParamsSchema = Schema.Struct({
  ...worktreeParamsSchema.fields,
  runId: Schema.String,
  assetId: Schema.String,
});
export type WalkthroughAssetParams = typeof walkthroughAssetParamsSchema.Type;
export type ReadWalkthroughResult = typeof domainRunSchema.Type;
export type StartWalkthroughRequest = typeof startWalkthroughRequestSchema.Type;
const startWalkthroughRequestSchema = Schema.Struct({
  base: Schema.optional(Schema.String),
  pullRequestNumber: Schema.optional(Schema.Int.check(Schema.isGreaterThan(0))),
  writer: Schema.optional(writerSchema),
});
export const readWalkthroughResponseSchema = Schema.Struct({
  walkthrough: nullableAsUndefined(walkthroughRunSchema),
  outOfDate: Schema.Boolean,
});
export class WalkthroughsApi extends porcelainApi.add(
  HttpApiGroup.make('walkthroughs')
    .add(
      HttpApiEndpoint.post(
        'startWalkthrough',
        '/api/worktrees/:worktreeId/walkthrough',
        {
          disableCodecs: true,
          params: worktreeParamsSchema,
          payload: startWalkthroughRequestSchema,
          success: walkthroughRunSchema,
          error: [
            ...worktreeFailures,
            ...gitReadFailures,
            httpFailure(WalkthroughFailedError, 'UnprocessableEntity', {
              message: { fromError: true },
            }),
          ],
        },
      ),
      HttpApiEndpoint.get(
        'readWalkthrough',
        '/api/worktrees/:worktreeId/walkthrough',
        {
          disableCodecs: true,
          params: worktreeParamsSchema,
          success: readWalkthroughResponseSchema,
          error: [...worktreeFailures, ...gitReadFailures],
        },
      ),
      HttpApiEndpoint.get(
        'readWalkthroughAsset',
        '/api/worktrees/:worktreeId/walkthrough/:runId/assets/:assetId',
        {
          disableCodecs: true,
          params: walkthroughAssetParamsSchema,
          success: Schema.Uint8Array.pipe(HttpApiSchema.asUint8Array()),
          error: [
            ...worktreeFailures,
            httpFailure(WalkthroughAssetNotFoundError, 'NotFound'),
          ],
        },
      ),
    )
    .middleware(PairedRequest),
) {}
