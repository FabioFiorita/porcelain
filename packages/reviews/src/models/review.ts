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

export type LayerArrow = {
  from: string;
  to: string;
  label?: string | undefined;
};

export type LayerDraft = {
  id: string;
  title: string;
  summary: string;
  lanes: string[];
  steps: StepDraft[];
  arrows?: LayerArrow[] | undefined;
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

export type DiagramArrow = {
  from: string;
  to: string;
  label?: string | undefined;
  dashed?: boolean | undefined;
};

export type Diagram = {
  lanes: string[];
  boxes: DiagramBox[];
  arrows: DiagramArrow[];
};

export type ReviewDiagram = {
  after: Diagram;
  before?: Diagram | undefined;
};

export type ReviewDraft = {
  expectedRevision: number;
  summaryHtml: string;
  diagram?: ReviewDiagram | undefined;
  layers: LayerDraft[];
};

export type ReviewStep = StepDraft & {
  published: string[];
};

export type ReviewLayer = Omit<LayerDraft, 'steps'> & {
  steps: ReviewStep[];
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
  layers: ReviewLayer[];
};

export type ReviewDraftProblem =
  | 'duplicate-layer-id'
  | 'duplicate-step-id'
  | 'step-lane-out-of-range'
  | 'unknown-arrow-step'
  | 'box-lane-out-of-range'
  | 'unknown-arrow-box';

export type ReviewSummary = Pick<
  Review,
  'summaryHtml' | 'summaryToken' | 'summarySecret'
>;
