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

export type SignedSummary = {
  token: string;
  expires: number;
  signature: string;
  byteLength: number;
};

export type ResolvedReview = {
  environmentId: string;
  worktreeId: string;
  revision: number;
  publishedAt: string;
  active: boolean;
  diagnostics: 'current' | 'unavailable';
  summary: SignedSummary;
  diagram?: ReviewDiagram | undefined;
  layers: ResolvedLayer[];
  notExplained: UnexplainedChange[];
};
