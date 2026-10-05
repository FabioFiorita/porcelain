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
const layerArrowSchema = Schema.Struct({
  from: Schema.mutableKey(Schema.String),
  to: Schema.mutableKey(Schema.String),
  label: Schema.mutableKey(
    Schema.optional(Schema.Union([Schema.String, Schema.Undefined])),
  ),
});
const layerDraftSchema = Schema.Struct({
  id: Schema.mutableKey(Schema.String),
  title: Schema.mutableKey(Schema.String),
  summary: Schema.mutableKey(Schema.String),
  lanes: Schema.mutableKey(Schema.Array(Schema.String)),
  steps: Schema.mutableKey(Schema.Array(stepDraftSchema)),
  arrows: Schema.mutableKey(
    Schema.optional(
      Schema.Union([Schema.Array(layerArrowSchema), Schema.Undefined]),
    ),
  ),
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
  lane: Schema.mutableKey(Schema.Number),
  label: Schema.mutableKey(Schema.String),
  detail: Schema.mutableKey(
    Schema.optional(Schema.Union([Schema.String, Schema.Undefined])),
  ),
  kind: Schema.mutableKey(
    Schema.Union([
      Schema.Literal('actor'),
      Schema.Literal('component'),
      Schema.Literal('storage'),
      Schema.Literal('transport'),
      Schema.Literal('credential'),
    ]),
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
});
const diagramArrowSchema = Schema.Struct({
  from: Schema.mutableKey(Schema.String),
  to: Schema.mutableKey(Schema.String),
  label: Schema.mutableKey(
    Schema.optional(Schema.Union([Schema.String, Schema.Undefined])),
  ),
  dashed: Schema.mutableKey(
    Schema.optional(Schema.Union([Schema.Boolean, Schema.Undefined])),
  ),
});
const diagramSchema = Schema.Struct({
  lanes: Schema.mutableKey(Schema.Array(Schema.String)),
  boxes: Schema.mutableKey(Schema.Array(diagramBoxSchema)),
  arrows: Schema.mutableKey(Schema.Array(diagramArrowSchema)),
});
export const reviewDiagramSchema = Schema.Struct({
  after: Schema.mutableKey(diagramSchema),
  before: Schema.mutableKey(
    Schema.optional(Schema.Union([diagramSchema, Schema.Undefined])),
  ),
});

import type { Brand } from 'effect';
import type { ProofDraft, ProofFile, ReviewProof } from './review-proof.ts';

export type CodePointer = typeof codePointerSchema.Type;

export type StepDraft = typeof stepDraftSchema.Type;

export type LayerDraft = typeof layerDraftSchema.Type;

export type DiagramBox = typeof diagramBoxSchema.Type;

export type Diagram = typeof diagramSchema.Type;

export type ReviewDiagram = typeof reviewDiagramSchema.Type;

export type ReviewDraft = {
  expectedRevision: number;
  summaryHtml: string;
  diagram?: ReviewDiagram | undefined;
  layers: readonly LayerDraft[];
  proof?: ProofDraft | undefined;
};

export type ReviewStep = typeof reviewStepSchema.Type;

export type ReviewLayer = typeof reviewLayerSchema.Type;

export type Review = {
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

export type ReviewActivity = {
  worktreeId: string;
  revision: number;
  active: boolean;
};

export type SignatureRequest = { secret: string; message: string };

export type ReviewDraftProblem =
  | { kind: 'duplicate-layer-id' }
  | { kind: 'reversed-pointer' }
  | { kind: 'duplicate-step-id' }
  | { kind: 'step-lane-out-of-range' }
  | { kind: 'unknown-arrow-step' }
  | { kind: 'box-lane-out-of-range' }
  | { kind: 'unknown-arrow-box' }
  | { kind: 'unknown-proof-target' };

export type ValidatedReviewDraft = Brand.Branded<
  Readonly<ReviewDraft>,
  'Porcelain/ValidatedReviewDraft'
>;
