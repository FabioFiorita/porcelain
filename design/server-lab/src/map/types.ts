// Shape of the curated architecture map and test audit rendered by the lab.
// Paths are repository-relative (e.g. `apps/server/src/app.ts`).

export type AreaId =
  | 'connection'
  | 'inventory'
  | 'changes'
  | 'review-layers'
  | 'comments'
  | 'artifacts'
  | 'files'
  | 'history'
  | 'git-actions'
  | 'mcp'
  | 'lifecycle';

export type SourceRef = { path: string; line?: number; symbol?: string };

export type RunnerName =
  | 'operations'
  | 'discovery'
  | 'browsing'
  | 'drafting'
  | 'none';

export type Layer =
  | 'web'
  | 'route'
  | 'application'
  | 'runner'
  | 'use-case'
  | 'repository'
  | 'git'
  | 'filesystem'
  | 'database'
  | 'agent-cli';

export type Step = {
  layer: Layer;
  /** Symbol as it appears in code, e.g. `ReadWorktreeStatus.execute`. */
  name: string;
  /** One plain sentence: what this step does in this flow. */
  what: string;
  source: SourceRef;
};

export type WebTrigger = {
  /** Query/mutation hook or view, e.g. `useInventory`. */
  hook: string;
  source: SourceRef;
  /** When it fires and how often: mount, per worktree, staleTime, focus refetch, invalidations. */
  when: string;
};

export type Flow = {
  /** Stable id, `<area>.<verb>`, e.g. `inventory.summary`. */
  id: string;
  title: string;
  /** Path as registered on the root (without the `/api` prefix), with `:params`. */
  endpoint?: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    path: string;
    source: SourceRef;
  };
  mcpTool?: { name: string; source: SourceRef };
  webTriggers: WebTrigger[];
  /** Ordered chain from the entry point down to resources. */
  steps: Step[];
  runner: RunnerName;
  /** Git invocations in order, abbreviated, with repetition noted: `rev-parse --absolute-git-dir (verifyCheckout, before+after)`. */
  gitCommands: string[];
  tables: { name: string; access: 'read' | 'write' }[];
  /** How cost grows: per changed file, per worktree, per commit page... */
  cost: string;
  notes?: string;
};

export type Decision = {
  title: string;
  /** Why, in two or three sentences, including the tradeoff. */
  summary: string;
  /** Repo-relative decision document, when one exists. */
  doc?: string;
  source?: SourceRef;
};

export type Observation = {
  kind:
    | 'performance'
    | 'correctness'
    | 'risk'
    | 'complexity'
    | 'question'
    | 'good';
  title: string;
  detail: string;
  sources: SourceRef[];
  confidence: 'verified' | 'likely' | 'speculative';
};

export type Area = {
  id: AreaId;
  title: string;
  /** Where a user meets this in the web app. */
  webSurface: string;
  /** Two to four plain sentences. */
  summary: string;
  flows: Flow[];
  decisions: Decision[];
  observations: Observation[];
};

export type SpecAudit = {
  file: string;
  areas: AreaId[];
  kind: 'unit' | 'integration' | 'http' | 'process' | 'property';
  /** What runs for real: git, sqlite, http, filesystem, child-process... */
  real: string[];
  /** What is faked, stubbed or injected. */
  fakes: string[];
  tests: { name: string; asserts: string }[];
  strengths: string[];
  /** Plausible failures these tests would not catch. */
  gaps: string[];
  verdict: 'strong' | 'adequate' | 'weak' | 'misleading';
};

export type AreaTestSummary = {
  area: AreaId;
  verdict: 'strong' | 'adequate' | 'weak' | 'misleading';
  summary: string;
  /** Tests that should exist and do not. */
  missing: string[];
};
