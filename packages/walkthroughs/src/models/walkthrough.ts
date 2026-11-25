import { Schema } from 'effect';
import {
  walkthroughBlockSchema,
  type WalkthroughChecks,
  type WalkthroughBlockRequest,
} from './blocks.ts';

export const claudeEffortSchema = Schema.Literals([
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
]);
const codexEffortSchema = Schema.Literals([
  'none',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
  'ultra',
]);
export const writerEffortSchema = codexEffortSchema;
const modelNameSchema = Schema.String;
const latestFamilySchema = Schema.optional(Schema.String);
export const writerSchema = Schema.Union([
  Schema.Struct({
    provider: Schema.Literal('claude'),
    model: modelNameSchema,
    effort: claudeEffortSchema,
    latest: latestFamilySchema,
  }),
  Schema.Struct({
    provider: Schema.Literal('codex'),
    model: modelNameSchema,
    effort: codexEffortSchema,
    latest: latestFamilySchema,
  }),
]);
export type WalkthroughWriterChoice = typeof writerSchema.Type;
export const walkthroughModelSchema = Schema.Struct({
  provider: Schema.Literals(['claude', 'codex']),
  model: modelNameSchema,
  label: Schema.String,
  family: Schema.optional(Schema.String),
  efforts: Schema.Array(writerEffortSchema),
  defaultEffort: writerEffortSchema,
});
export type WalkthroughModel = typeof walkthroughModelSchema.Type;
export const walkthroughFailureSchema = Schema.Struct({
  kind: Schema.Literals([
    'signed_out',
    'agent_not_installed',
    'timed_out',
    'unusable_output',
    'other',
  ]),
  message: Schema.String,
});
export const walkthroughContentSchema = Schema.Struct({
  outcome: Schema.Literals(['needs_you', 'worth_knowing', 'nothing']),
  title: Schema.String,
  summary: Schema.String,
  growth: Schema.Array(
    Schema.Struct({
      change: Schema.Literals(['added', 'changed', 'removed']),
      what: Schema.String,
      note: Schema.String,
    }),
  ),
  version: Schema.Literal(1),
  stops: Schema.Array(
    Schema.Struct({
      title: Schema.String,
      explanation: Schema.String,
      blocks: Schema.Array(walkthroughBlockSchema),
    }),
  ),
  onlyInTranscript: Schema.Array(
    Schema.Struct({ point: Schema.String, answer: Schema.String }),
  ),
  stillUnclear: Schema.Array(Schema.String),
});
const walkthroughStageSchema = Schema.Literals([
  'queued',
  'evidence',
  'transcript',
  'writing',
  'validating',
  'ready',
  'failed',
]);
const walkthroughProgressSchema = Schema.Struct({
  stage: walkthroughStageSchema,
  at: Schema.String,
  message: Schema.String,
});
export type WalkthroughProgress = typeof walkthroughProgressSchema.Type;
export const walkthroughFreshnessSchema = Schema.Literals([
  'current',
  'changed',
  'unknown',
]);
export type WalkthroughFreshness = typeof walkthroughFreshnessSchema.Type;
export const walkthroughRunSchema = Schema.Struct({
  id: Schema.String,
  projectId: Schema.String,
  worktreeId: Schema.String,
  pullRequestNumber: Schema.optional(Schema.Int),
  pullRequestRepository: Schema.optional(
    Schema.Struct({ owner: Schema.String, repo: Schema.String }),
  ),
  evidenceUnavailable: Schema.optional(
    Schema.Literals(['head_mismatch', 'github_account', 'github_unavailable']),
  ),
  baseOid: Schema.String,
  headOid: Schema.String,
  contentTreeOid: Schema.String,
  baseRef: Schema.String,
  includesUncommitted: Schema.Boolean,
  branch: Schema.optional(Schema.String),
  writer: writerSchema,
  sessionId: Schema.optional(Schema.String),
  createdAt: Schema.String,
  progress: Schema.optional(Schema.Array(walkthroughProgressSchema)),
  state: Schema.Union([
    Schema.Struct({ status: Schema.Literal('queued') }),
    Schema.Struct({ status: Schema.Literal('running') }),
    Schema.Struct({
      status: Schema.Literal('ready'),
      content: walkthroughContentSchema,
      writtenAt: Schema.String,
      durationMs: Schema.Number,
      costUsd: Schema.optional(Schema.Number),
    }),
    Schema.Struct({
      status: Schema.Literal('failed'),
      failure: walkthroughFailureSchema,
    }),
  ]),
});
export type WalkthroughRun = typeof walkthroughRunSchema.Type;
export type WalkthroughFailure = typeof walkthroughFailureSchema.Type;
export type WalkthroughContent = typeof walkthroughContentSchema.Type;
export type WalkthroughDraft = Omit<WalkthroughContent, 'stops'> & {
  readonly stops: readonly {
    readonly title: string;
    readonly explanation: string;
    readonly blocks: readonly WalkthroughBlockRequest[];
  }[];
};
export type DiffFile = {
  readonly path: string;
  readonly oldPath?: string | undefined;
  readonly hunks: readonly {
    readonly oldStart: number;
    readonly oldEnd: number;
    readonly newStart: number;
    readonly newEnd: number;
  }[];
};
export const walkthroughJobSchema = Schema.Struct({
  run: walkthroughRunSchema,
  worktreePath: Schema.String,
  patch: Schema.String,
  omittedFiles: Schema.optional(Schema.Array(Schema.String)),
  files: Schema.Array(
    Schema.Struct({
      path: Schema.String,
      oldPath: Schema.optional(Schema.String),
      hunks: Schema.Array(
        Schema.Struct({
          oldStart: Schema.Int,
          oldEnd: Schema.Int,
          newStart: Schema.Int,
          newEnd: Schema.Int,
        }),
      ),
    }),
  ),
});
export type WalkthroughJob = {
  readonly run: WalkthroughRun;
  readonly worktreePath: string;
  readonly patch: string;
  readonly omittedFiles?: readonly string[] | undefined;
  readonly files: readonly DiffFile[];
};
export type EvidenceAsset = {
  readonly id: string;
  readonly mediaType: string;
  readonly bytes: Uint8Array;
  readonly caption: string;
};
export type WalkthroughEvidence = {
  readonly unavailable?: WalkthroughRun['evidenceUnavailable'];
  readonly title: string;
  readonly body: string;
  readonly checks: WalkthroughChecks | undefined;
  readonly assets: readonly EvidenceAsset[];
};

export const walkthroughSettingsSchema = Schema.Struct({
  mode: Schema.Literals(['manual', 'automatic']),
  writer: Schema.optional(writerSchema),
});
export type WalkthroughSettings = typeof walkthroughSettingsSchema.Type;
