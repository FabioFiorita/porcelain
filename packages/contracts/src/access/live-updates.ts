import { Schema } from 'effect';
import {
  LIVE_PATHS_PER_WORKTREE,
  LIVE_PROJECTS,
  LIVE_WORKTREES,
} from '../shared/limits.ts';
import { gitActionReceiptSchema } from '../shared/git-action-receipt.ts';
import { relativePathSchema } from '../shared/relative-path.ts';
import { worktreeIdSchema } from '../shared/schema.ts';
import type { DeviceRoute } from './pairing.ts';
import type { Principal } from './principal.ts';

export const liveSubscriptionSchema = Schema.Struct({
  type: Schema.Literal('subscribe'),
  projects: Schema.Array(Schema.String.check(Schema.isUUID())).check(
    Schema.isMaxLength(LIVE_PROJECTS),
  ),
  worktrees: Schema.Array(
    Schema.Struct({
      projectId: Schema.String.check(Schema.isUUID()),
      worktreeId: worktreeIdSchema,
      paths: Schema.Array(relativePathSchema).check(
        Schema.isMaxLength(LIVE_PATHS_PER_WORKTREE),
      ),
    }),
  ).check(Schema.isMaxLength(LIVE_WORKTREES)),
});

export const liveNoticeSchema = Schema.Union([
  Schema.Struct({ type: Schema.Literal('ready') }),
  Schema.Struct({ type: Schema.Literal('subscribed') }),
  Schema.Struct({ type: Schema.Literal('heartbeat') }),
  Schema.Struct({ type: Schema.Literal('inventory') }),
  Schema.Struct({
    type: Schema.Literal('git-action'),
    projectId: Schema.String.check(Schema.isUUID()),
    worktreeId: worktreeIdSchema,
    receipt: gitActionReceiptSchema,
  }),
  Schema.Struct({
    type: Schema.Literal('project'),
    projectId: Schema.String.check(Schema.isUUID()),
    change: Schema.Literals(['files', 'preferences']),
  }),
  Schema.Struct({
    type: Schema.Literal('worktree'),
    projectId: Schema.String.check(Schema.isUUID()),
    worktreeId: worktreeIdSchema,
    change: Schema.Literals(['files', 'git', 'reviewed', 'comments', 'review']),
  }),
]);

export type LiveNotice = typeof liveNoticeSchema.Type;

export const issueLiveTicketResponseSchema = Schema.Struct({
  ticket: Schema.String,
  expiresAt: Schema.String,
});

export type IssueLiveTicketRequest = { viewer: Principal; route: DeviceRoute };
export type IssueLiveTicketResponse = typeof issueLiveTicketResponseSchema.Type;

export const liveUpdatesQuerySchema = Schema.Struct({
  ticket: Schema.optional(Schema.String),
});
export const liveUpgradeResponseSchema = Schema.Undefined;
