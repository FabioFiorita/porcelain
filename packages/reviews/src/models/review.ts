import { Schema, Struct } from 'effect';
const codePointerSchema = Schema.Struct({
  path: Schema.mutableKey(Schema.String),
  startLine: Schema.mutableKey(Schema.Number),
  endLine: Schema.mutableKey(Schema.Number),
  symbol: Schema.mutableKey(
    Schema.optional(Schema.Union([Schema.String, Schema.Undefined])),
  ),
});
const stepDraftSchema = Schema.Struct({
  id: Schema.mutableKey(Schema.String),
  lane: Schema.mutableKey(Schema.Number),
  title: Schema.mutableKey(Schema.String),
  text: Schema.mutableKey(Schema.String),
  kind: Schema.mutableKey(
    Schema.Union([Schema.Literal('changed'), Schema.Literal('context')]),
  ),
  pointer: Schema.mutableKey(codePointerSchema),
});
const layerDraftSchema = Schema.Struct({
  id: Schema.mutableKey(Schema.String),
  title: Schema.mutableKey(Schema.String),
  summary: Schema.mutableKey(Schema.String),
  lanes: Schema.mutableKey(Schema.Array(Schema.String)),
  steps: Schema.mutableKey(Schema.Array(stepDraftSchema)),
});
const reviewStepSchema = Schema.Struct({
  ...stepDraftSchema.fields,
  published: Schema.mutableKey(Schema.Array(Schema.String)),
});
export const reviewLayerSchema = Schema.Struct({
  ...Struct.omit(layerDraftSchema.fields, ['steps']),
  steps: Schema.mutableKey(Schema.Array(reviewStepSchema)),
  fingerprint: Schema.mutableKey(Schema.String),
});
const diagramBoxSchema = Schema.Struct({
  id: Schema.mutableKey(Schema.String),
  label: Schema.mutableKey(Schema.String),
  detail: Schema.mutableKey(
    Schema.optional(Schema.Union([Schema.String, Schema.Undefined])),
  ),
  change: Schema.mutableKey(
    Schema.optional(
      Schema.Union([
        Schema.Literal('new'),
        Schema.Literal('changed'),
        Schema.Literal('removed'),
        Schema.Undefined,
      ]),
    ),
  ),
  problem: Schema.mutableKey(
    Schema.optional(Schema.Union([Schema.String, Schema.Undefined])),
  ),
  layerId: Schema.mutableKey(
    Schema.optional(Schema.Union([Schema.String, Schema.Undefined])),
  ),
  decision: Schema.mutableKey(Schema.optional(Schema.Literal(true))),
});
const diagramArrowSchema = Schema.Struct({
  from: Schema.mutableKey(Schema.String),
  to: Schema.mutableKey(Schema.String),
  label: Schema.mutableKey(
    Schema.optional(Schema.Union([Schema.String, Schema.Undefined])),
  ),
});
const diagramSchema = Schema.Struct({
  boxes: Schema.mutableKey(Schema.Array(diagramBoxSchema)),
  arrows: Schema.mutableKey(Schema.Array(diagramArrowSchema)),
});
export const reviewDiagramSchema = Schema.Struct({
  after: Schema.mutableKey(diagramSchema),
});

import type { Brand } from 'effect';
import type { ProofDraft, ProofFile, ReviewProof } from './review-proof.ts';

export type CodePointer = typeof codePointerSchema.Type;

export type StepDraft = typeof stepDraftSchema.Type;

export type LayerDraft = typeof layerDraftSchema.Type;

export type DiagramBox = typeof diagramBoxSchema.Type;

export type Diagram = typeof diagramSchema.Type;

export type ReviewDiagram = typeof reviewDiagramSchema.Type;

export const reviewVerdictSchema = Schema.Struct({
  asked: Schema.Struct({
    text: Schema.String,
    links: Schema.optional(
      Schema.Array(Schema.Struct({ title: Schema.String, url: Schema.String })),
    ),
  }),
  recommendation: Schema.Literals(['merge', 'hold']),
  reasons: Schema.Array(Schema.String),
  notProven: Schema.Array(
    Schema.Struct({ what: Schema.String, why: Schema.String }),
  ),
  removed: Schema.Array(
    Schema.Struct({
      behavior: Schema.String,
      why: Schema.String,
      paths: Schema.Array(Schema.String),
    }),
  ),
});
export type ReviewVerdict = typeof reviewVerdictSchema.Type;
export const reviewRecordSchema = Schema.Struct({
  reviewId: Schema.String,
  projectId: Schema.String,
  commonDirectory: Schema.String,
  branch: Schema.String,
  pullRequest: Schema.optional(Schema.String),
  state: Schema.Literals(['open', 'closed']),
  latestRevision: Schema.Int,
  lastSeenRevision: Schema.Int,
});
export type ReviewRecord = typeof reviewRecordSchema.Type;
export type ReviewKey = { reviewId: string; revision?: number | undefined };
export type BranchReviewKey = {
  projectId: string;
  branch: string;
  pullRequest?: string | undefined;
};
export const reviewFileSchema = Schema.Struct({
  path: Schema.String,
  oldPath: Schema.optional(Schema.String),
  newPath: Schema.optional(Schema.String),
  oldOid: Schema.optional(Schema.String),
  newOid: Schema.optional(Schema.String),
  oldMode: Schema.String,
  newMode: Schema.String,
  status: Schema.Literals([
    'added',
    'modified',
    'deleted',
    'renamed',
    'type-changed',
  ]),
});
export type ReviewCommit = {
  files: readonly (typeof reviewFileSchema.Type)[];
  projectId: string;
  commonDirectory: string;
  branch: string;
  worktreePath: string;
  worktreeName: string;
  headOid: string;
  base: string;
  baseOid: string;
  mergeBaseOid: string;
};
export type ReviewDraft = {
  expectedRevision: number;
  summaryHtml?: string | undefined;
  verdict: ReviewVerdict;
  reviewId?: string | undefined;
  base?: string | undefined;
  pullRequest?: string | undefined;
  diagram?: ReviewDiagram | undefined;
  layers: readonly LayerDraft[];
  proof?: ProofDraft | undefined;
};

export type ReviewStep = typeof reviewStepSchema.Type;

export type ReviewLayer = typeof reviewLayerSchema.Type;

export const unexplainedChangeSchema = Schema.Struct({
  path: Schema.String,
  ranges: Schema.Array(
    Schema.Struct({ startLine: Schema.Number, endLine: Schema.Number }),
  ),
  deleted: Schema.optional(Schema.Boolean),
  binary: Schema.optional(Schema.Boolean),
});
export type Review = ReviewCommit & {
  notExplained: readonly (typeof unexplainedChangeSchema.Type)[];
  reviewId: string;
  verdict: ReviewVerdict;
  worktreeId: string;
  revision: number;
  publishedAt: string;
  active: boolean;
  summaryHtml: string;
  summaryToken: string;
  summarySecret: string;
  diagram?: ReviewDiagram | undefined;
  layers: readonly ReviewLayer[];
  proof?: ReviewProof | undefined;
};

export type ReviewSave = Review & {
  proofFiles?: readonly ProofFile[] | undefined;
};

export type ReviewSummary = Pick<
  Review,
  'summaryHtml' | 'summaryToken' | 'summarySecret'
>;

export type ReviewSummaryKey = { token: string };

export type SignatureRequest = { secret: string; message: string };

export type ReviewDraftProblem =
  | { kind: 'duplicate-layer-id' }
  | { kind: 'reversed-pointer' }
  | { kind: 'duplicate-step-id' }
  | { kind: 'step-lane-out-of-range' }
  | { kind: 'unknown-box-layer' }
  | { kind: 'invalid-decision-box' }
  | { kind: 'unknown-arrow-box' }
  | { kind: 'unknown-proof-target' };

export type ValidatedReviewDraft = Brand.Branded<
  Readonly<ReviewDraft>,
  'Porcelain/ValidatedReviewDraft'
>;
