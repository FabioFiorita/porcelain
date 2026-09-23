import type {
  ReviewDiagram,
  StoredReview,
  StoredReviewLayer,
  StoredReviewStep,
} from './stored-review.ts';

export type ReviewLayerInput = Omit<
  StoredReviewLayer,
  'steps' | 'fingerprint'
> & {
  steps: Omit<StoredReviewStep, 'published'>[];
};

export type ReviewPublication = {
  expectedRevision: number;
  summaryHtml: string;
  diagram?: ReviewDiagram | undefined;
  layers: ReviewLayerInput[];
};

export type ReviewChange = {
  path: string;
  untracked: boolean;
  deleted: boolean;
};

export type ReviewPatch =
  | { path: string; scope: 'staged' | 'unstaged'; kind: 'text'; patch: string }
  | { path: string; scope: 'staged' | 'unstaged'; kind: 'binary' };

export type ReviewDiagnostics = {
  changed: ReadonlyMap<string, ReadonlySet<number>>;
  deleted: ReadonlyMap<string, ReadonlySet<number>>;
  binary: ReadonlySet<string>;
};

export type ResolvedReviewStep = Omit<
  StoredReviewStep,
  'published' | 'pointer'
> & {
  pointer: StoredReviewStep['pointer'] & { textFingerprint: string };
  location:
    | { state: 'changed' }
    | { state: 'current' | 'committed'; startLine: number; endLine: number };
};

export type ResolvedReviewLayer = Omit<StoredReviewLayer, 'steps'> & {
  steps: ResolvedReviewStep[];
};

export type ReviewResponse = Pick<
  StoredReview,
  'worktreeId' | 'revision' | 'publishedAt' | 'active'
> & {
  environmentId: string;
  diagnostics: 'current' | 'unavailable';
  summary: { url: string; byteLength: number };
  diagram?: ReviewDiagram | undefined;
  layers: ResolvedReviewLayer[];
  notExplained: {
    path: string;
    ranges: { startLine: number; endLine: number }[];
    deleted?: boolean | undefined;
    binary?: boolean | undefined;
  }[];
};
