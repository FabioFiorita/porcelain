import type { ReviewChange, ReviewDiagnostics } from './review-evidence.ts';
import type { ResolvedProof } from './review-proof.ts';
import type {
  CodePointer,
  ReviewDiagram,
  ReviewLayer,
  StepDraft,
} from './review.ts';

type StepLocation =
  | { state: 'changed' }
  | { state: 'current' | 'committed'; startLine: number; endLine: number };

export type ResolvedStep = Omit<StepDraft, 'pointer'> & {
  pointer: CodePointer & { textFingerprint: string };
  location: StepLocation;
};

export type ResolvedLayer = Omit<ReviewLayer, 'steps'> & {
  steps: readonly ResolvedStep[];
};

export type UnexplainedChange = {
  path: string;
  ranges: readonly { startLine: number; endLine: number }[];
  deleted?: boolean | undefined;
  binary?: boolean | undefined;
};

type SummaryGrant = {
  token: string;
  expires: string;
  signature: string;
  byteLength: number;
};

export type SummaryLinkLimits = {
  lifetimeMs: number;
};

export type ResolvedReview = {
  environmentId: string;
  worktreeId: string;
  revision: number;
  publishedAt: string;
  active: boolean;
  diagnostics: 'current';
  summary: SummaryGrant;
  diagram?: ReviewDiagram | undefined;
  layers: readonly ResolvedLayer[];
  notExplained: readonly UnexplainedChange[];
  proof: ResolvedProof;
};

export type ReviewResolution = {
  changes: readonly ReviewChange[];
  diagnostics: ReviewDiagnostics;
  layers: readonly ResolvedLayer[];
};
