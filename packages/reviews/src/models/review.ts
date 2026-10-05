import type { Brand } from 'effect';
import type { ProofDraft, ProofFile, ReviewProof } from './review-proof.ts';

export type CodePointer = {
  path: string;
  startLine: number;
  endLine: number;
  symbol?: string | undefined;
};

export type StepDraft = {
  id: string;
  lane: number;
  title: string;
  text: string;
  kind: 'changed' | 'context';
  pointer: CodePointer;
};

type LayerArrow = {
  from: string;
  to: string;
  label?: string | undefined;
};

export type LayerDraft = {
  id: string;
  title: string;
  summary: string;
  lanes: readonly string[];
  steps: readonly StepDraft[];
  arrows?: readonly LayerArrow[] | undefined;
};

export type DiagramBox = {
  id: string;
  lane: number;
  label: string;
  detail?: string | undefined;
  kind: 'actor' | 'component' | 'storage' | 'transport' | 'credential';
  change?: 'new' | 'changed' | 'removed' | undefined;
  problem?: string | undefined;
  layerId?: string | undefined;
};

type DiagramArrow = {
  from: string;
  to: string;
  label?: string | undefined;
  dashed?: boolean | undefined;
};

export type Diagram = {
  lanes: readonly string[];
  boxes: readonly DiagramBox[];
  arrows: readonly DiagramArrow[];
};

export type ReviewDiagram = {
  after: Diagram;
  before?: Diagram | undefined;
};

export type ReviewDraft = {
  expectedRevision: number;
  summaryHtml: string;
  diagram?: ReviewDiagram | undefined;
  layers: readonly LayerDraft[];
  proof?: ProofDraft | undefined;
};

export type ReviewStep = StepDraft & {
  published: readonly string[];
};

export type ReviewLayer = Omit<LayerDraft, 'steps'> & {
  steps: readonly ReviewStep[];
  fingerprint: string;
};

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
