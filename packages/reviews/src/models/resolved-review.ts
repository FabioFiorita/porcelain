import type { ReviewChange, ReviewDiagnostics } from './review-evidence.ts';
import type {
  CodePointer,
  ReviewDiagram,
  ReviewLayer,
  StepDraft,
} from './review.ts';

export type StepLocation =
  | { state: 'changed' }
  | { state: 'current' | 'committed'; startLine: number; endLine: number };

export type ResolvedStep = Omit<StepDraft, 'pointer'> & {
  pointer: CodePointer & { textFingerprint: string };
  location: StepLocation;
};

export type ResolvedLayer = Omit<ReviewLayer, 'steps'> & {
  steps: ResolvedStep[];
};

export type UnexplainedChange = {
  path: string;
  ranges: { startLine: number; endLine: number }[];
  deleted?: boolean | undefined;
  binary?: boolean | undefined;
};

export type SummaryGrant = {
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
  layers: ResolvedLayer[];
  notExplained: UnexplainedChange[];
};

export type ReviewResolution = {
  changes: ReviewChange[];
  diagnostics: ReviewDiagnostics;
  layers: ResolvedLayer[];
};
