import { Schema } from 'effect';
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/http-api';
import {
  walkthroughRunSchema as domainRunSchema,
  walkthroughContentSchema,
  writerSchema,
  walkthroughModelSchema,
  walkthroughFreshnessSchema,
} from '@porcelain/walkthroughs/models';
import {
  UnsupportedWalkthroughEffortError,
  WalkthroughFailedError,
  WalkthroughAssetNotFoundError,
  WalkthroughCallNotFoundError,
  WalkthroughMessageNotFoundError,
  WalkthroughTargetNotFoundError,
} from '@porcelain/walkthroughs/errors';
import { nullableAsUndefined } from '../shared/schema.ts';
import { porcelainApi } from '../shared/http-api.ts';
import { PairedRequest } from '../shared/http-caller.ts';
import { worktreeParamsSchema } from '../shared/worktree-params.ts';
import { worktreeFailures } from '../shared/worktree-failures.ts';
import { gitReadFailures } from '../shared/git-read-failures.ts';
import {
  addWalkthroughMessageRequestSchema,
  decideWalkthroughCallRequestSchema,
  walkthroughCallParamsSchema,
  walkthroughConversationsResponseSchema,
  walkthroughMessageParamsSchema,
  walkthroughConversationParamsSchema,
} from './conversations.ts';
import { httpFailure } from '../shared/http-failure.ts';
const readySchema = Schema.Struct({
  status: Schema.Literal('ready'),
  content: walkthroughContentSchema,
  writtenAt: Schema.String,
  durationMs: Schema.Number,
  costUsd: nullableAsUndefined(Schema.Number),
});
const walkthroughRunSchema = Schema.Struct({
  ...domainRunSchema.fields,
  contentTreeOid: Schema.String,
  baseRef: Schema.String,
  includesUncommitted: Schema.Boolean,
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
const readWalkthroughQuerySchema = Schema.Struct({
  excerptRunId: Schema.optional(Schema.String),
  excerptStep: Schema.optional(
    Schema.NumberFromString.check(Schema.isInt(), Schema.isGreaterThan(0)),
  ),
  excerptBlock: Schema.optional(
    Schema.NumberFromString.check(Schema.isInt(), Schema.isGreaterThan(0)),
  ),
  excerptNode: Schema.optional(Schema.String),
});
export type ReadWalkthroughQuery = typeof readWalkthroughQuerySchema.Type;
export const readWalkthroughResponseSchema = Schema.Struct({
  walkthrough: nullableAsUndefined(walkthroughRunSchema),
  attempt: Schema.optional(walkthroughRunSchema),
  freshness: walkthroughFreshnessSchema,
  capturedPatch: Schema.optional(Schema.String),
});
const walkthroughWriterSettingsQuerySchema = Schema.Struct({
  projectId: Schema.optional(Schema.String),
  refresh: Schema.optional(Schema.Literal('true')),
});
export type WalkthroughWriterSettingsQuery =
  typeof walkthroughWriterSettingsQuerySchema.Type;
export const walkthroughWriterSettingsSchema = Schema.Struct({
  writer: writerSchema,
  models: Schema.Array(walkthroughModelSchema),
  availability: Schema.optional(
    Schema.Literals(['ready', 'missing-model', 'unsupported-effort']),
  ),
});
export type WalkthroughWriterSettings =
  typeof walkthroughWriterSettingsSchema.Type;
export function isUnsupportedWalkthroughEffortFailure(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.name === UnsupportedWalkthroughEffortError.name
  );
}

export type SaveDefaultWalkthroughWriterRequest = typeof writerSchema.Type;

export class WalkthroughsApi extends porcelainApi.add(
  HttpApiGroup.make('walkthroughs')
    .add(
      HttpApiEndpoint.get(
        'readWalkthroughWriterSettings',
        '/api/walkthrough-settings',
        {
          disableCodecs: true,
          query: walkthroughWriterSettingsQuerySchema.fields,
          success: walkthroughWriterSettingsSchema,
        },
      ),
      HttpApiEndpoint.put(
        'saveDefaultWalkthroughWriter',
        '/api/walkthrough-settings',
        {
          disableCodecs: true,
          payload: writerSchema,
          success: writerSchema,
          error: httpFailure(
            UnsupportedWalkthroughEffortError,
            'UnprocessableEntity',
            { message: { fromError: true } },
          ),
        },
      ),
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
          query: readWalkthroughQuerySchema.fields,
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
      HttpApiEndpoint.get(
        'listWalkthroughConversations',
        '/api/worktrees/:worktreeId/walkthrough/:runId/conversations',
        {
          disableCodecs: true,
          params: walkthroughConversationParamsSchema,
          success: walkthroughConversationsResponseSchema,
          error: [
            ...worktreeFailures,
            httpFailure(WalkthroughTargetNotFoundError, 'NotFound'),
          ],
        },
      ),
      HttpApiEndpoint.post(
        'addWalkthroughMessage',
        '/api/worktrees/:worktreeId/walkthrough/:runId/conversations/messages',
        {
          disableCodecs: true,
          params: walkthroughConversationParamsSchema,
          payload: addWalkthroughMessageRequestSchema,
          success: walkthroughConversationsResponseSchema,
          error: [
            ...worktreeFailures,
            httpFailure(WalkthroughTargetNotFoundError, 'NotFound'),
          ],
        },
      ),
      HttpApiEndpoint.post(
        'retryWalkthroughAnswer',
        '/api/worktrees/:worktreeId/walkthrough/:runId/conversations/messages/:messageId/retry',
        {
          disableCodecs: true,
          params: walkthroughMessageParamsSchema,
          success: walkthroughConversationsResponseSchema,
          error: [
            ...worktreeFailures,
            httpFailure(WalkthroughTargetNotFoundError, 'NotFound'),
            httpFailure(WalkthroughMessageNotFoundError, 'NotFound'),
          ],
        },
      ),
      HttpApiEndpoint.put(
        'decideWalkthroughCall',
        '/api/worktrees/:worktreeId/walkthrough/:runId/calls/:step/:call/decision',
        {
          disableCodecs: true,
          params: walkthroughCallParamsSchema,
          payload: decideWalkthroughCallRequestSchema,
          success: walkthroughConversationsResponseSchema,
          error: [
            ...worktreeFailures,
            httpFailure(WalkthroughTargetNotFoundError, 'NotFound'),
            httpFailure(WalkthroughCallNotFoundError, 'NotFound'),
          ],
        },
      ),
    )
    .middleware(PairedRequest),
) {}
