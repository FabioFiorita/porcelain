// Messages shared by the lab supervisor, the traced runtime and the UI.
// Times are epoch milliseconds with sub-millisecond precision.

export type Origin =
  | 'web'
  | 'console'
  | 'bench'
  | 'setup'
  | 'mcp'
  | 'background';

export type ProcessSpan = {
  pid: number | undefined;
  /** Executable as spawned, e.g. `git`. */
  file: string;
  /** Arguments with the checkout path shortened to `<repo>`. */
  args: string[];
  start: number;
  end?: number;
  exitCode?: number | null;
  signal?: string | null;
  stdoutBytes?: number;
};

export type OperationSpan = {
  runner: string;
  operation: number;
  queued: number;
  started?: number;
  settled?: number;
  failed?: boolean;
};

export type SqlStatement = {
  at: number;
  sql: string;
  table: string;
  kind: 'read' | 'write' | 'other';
};

export type Trace = {
  id: string;
  origin: Origin;
  /** Bench run and step, or a console request id. */
  run?: string;
  step?: string;
  method: string;
  url: string;
  /** Registered route pattern, e.g. `/worktrees/:worktreeId/evidence`. */
  route?: string;
  status?: number;
  start: number;
  /** When the response finished or the client went away. */
  end?: number;
  aborted?: boolean;
  responseBytes?: number;
  operations: OperationSpan[];
  processes: ProcessSpan[];
  sqlCount: number;
  /** First statements only; `sqlCount` is exact. */
  sql: SqlStatement[];
  /** Work that finished after the response: abandoned or background continuation. */
  lateMs?: number;
  blocked?: string;
};

export type Vitals = {
  at: number;
  rssMb: number;
  heapMb: number;
  eventLoopP99Ms: number;
  eventLoopMaxMs: number;
  activeProcesses: number;
  queues: Record<string, { queued: number; running: number }>;
};

export type RouteInfo = {
  method: string;
  url: string;
  params?: unknown;
  querystring?: unknown;
  body?: unknown;
  response?: unknown;
};

export type WorktreeInfo = {
  path: string;
  branch: string;
  role: 'main' | 'review' | 'agent' | 'real';
};

export type RuntimeMode =
  | { kind: 'playground'; profile: string }
  | { kind: 'real'; repositories: string[] };

export type RuntimeState =
  | { status: 'stopped' }
  | { status: 'starting'; mode: RuntimeMode; since: number; log: string[] }
  | {
      status: 'ready';
      mode: RuntimeMode;
      since: number;
      readyMs: number;
      address: string;
      readOnly: boolean;
      playgroundRoot?: string;
      worktrees: WorktreeInfo[];
      routes: RouteInfo[];
      log: string[];
    }
  | { status: 'failed'; mode: RuntimeMode; error: string; log: string[] };

export type WebState =
  | { status: 'stopped' }
  | { status: 'starting'; url: string }
  | { status: 'ready'; url: string }
  | { status: 'failed'; error: string };

export type RepoShape = {
  trackedFiles: number;
  directories: number;
  trackedMb: number;
  sizeP50: number;
  sizeP90: number;
  sizeP99: number;
  sizeMax: number;
  over100Kb: number;
  over1Mb: number;
  binaryFiles: number;
  depthP50: number;
  depthMax: number;
  packages: number;
  commits: number;
  localBranches: number;
  remoteBranches: number;
  worktrees: number;
  changedEntries: number[];
  workingTreeFiles?: number;
  measuredMs: number;
};

export type BenchStepResult = {
  step: string;
  title: string;
  requests: number;
  processes: number;
  sql: number;
  wallMs: number;
  serverMs: number;
  queueMs: number;
  slowestMs: number;
  lateMs: number;
  errors: number;
};

export type BenchRun = {
  id: string;
  at: number;
  target: string;
  real: boolean;
  steps: BenchStepResult[];
  error?: string;
};

export type Budget = { processes?: number; wallMs?: number; sql?: number };

export type LabEvent =
  | { type: 'runtime'; state: RuntimeState }
  | { type: 'web'; state: WebState }
  | { type: 'trace'; trace: Trace }
  | { type: 'vitals'; vitals: Vitals }
  | { type: 'bench'; run: BenchRun; progress?: string; done: boolean }
  | { type: 'simulation'; message: string; ok: boolean }
  | { type: 'cleared' };

/** Runtime → supervisor IPC. */
export type RuntimeMessage =
  | { type: 'log'; line: string }
  | {
      type: 'ready';
      address: string;
      readOnly: boolean;
      playgroundRoot?: string;
      worktrees: WorktreeInfo[];
      routes: RouteInfo[];
      readyMs: number;
    }
  | { type: 'failed'; error: string }
  | { type: 'trace'; trace: Trace }
  | { type: 'vitals'; vitals: Vitals };
