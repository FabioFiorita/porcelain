export type CodePointerInput = {
  path: string;
  startLine: number;
  endLine: number;
  symbol?: string | undefined;
};

export type StoredReviewStep = {
  id: string;
  lane: number;
  title: string;
  text: string;
  kind: 'changed' | 'context';
  pointer: CodePointerInput;
  published: string[];
};

export type StoredReviewLayer = {
  id: string;
  title: string;
  summary: string;
  lanes: string[];
  steps: StoredReviewStep[];
  arrows?:
    | { from: string; to: string; label?: string | undefined }[]
    | undefined;
  fingerprint: string;
};

export type ReviewDiagram = {
  after: Diagram;
  before?: Diagram | undefined;
};

export type Diagram = {
  lanes: string[];
  boxes: {
    id: string;
    lane: number;
    label: string;
    detail?: string | undefined;
    kind: 'actor' | 'component' | 'storage' | 'transport' | 'credential';
    change?: 'new' | 'changed' | 'removed' | undefined;
    problem?: string | undefined;
    layerId?: string | undefined;
  }[];
  arrows: {
    from: string;
    to: string;
    label?: string | undefined;
    dashed?: boolean | undefined;
  }[];
};

export type StoredReview = {
  worktreeId: string;
  revision: number;
  publishedAt: string;
  active: boolean;
  summaryHtml: string;
  summaryToken: string;
  summarySecret: string;
  diagram?: ReviewDiagram | undefined;
  layers: StoredReviewLayer[];
};
