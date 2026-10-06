import type { EditFileRequest } from '@porcelain/contracts/files';
import type { liveSubscriptionSchema } from '@porcelain/contracts/access';

export type HttpRequest = {
  method: 'GET' | 'HEAD' | 'OPTIONS' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  query?: Record<string, string | number | boolean>;
  body?: unknown;
  rawBody?: string;
  contentType?: string;
  headers?: Record<string, string>;
  auth?:
    | 'paired'
    | 'desktop'
    | 'none'
    | { bearer: string }
    | { cookie: string };
  target?: 'network' | 'owner';
};

export type HttpResponse = {
  status: number;
  headers: Record<string, string>;
  body: unknown;
};

export type LiveConnection = {
  follow(subscription: typeof liveSubscriptionSchema.Type): Promise<void>;
  invalidFollow(payload: unknown): Promise<Record<string, unknown>>;
  next(
    accept: (notice: Record<string, unknown>) => boolean,
    timeoutMs?: number,
  ): Promise<Record<string, unknown>>;
  closed(timeoutMs?: number): Promise<{ code: number; reason: string }>;
  close(): Promise<void>;
};

export type LiveOptions = { ticket: string; origin?: string };

export type Fixture = {
  folders: { home: string; repository: string; state: string; web: string };
  branch: string;
  device: { label: string; platform: string };
  readme: { path: string; committed: string; changed: string };
  initialCommit: string;
  web: { shell: string; asset: { path: string; text: string }; escape: string };
  summaryLinkLifetimeMs: number;
  liveTicketLifetimeMs: number;
  gitActionDeadlineMs: number;
  inventoryStaleAfterMs: number;
  codingTool: {
    command: string;
    message: DraftedCommit;
    groups: DraftedCommit[];
  };
  perf: PerfSample | null;
};

export type PerfSample = {
  files: number;
  commits: number;
  worktrees: string[];
  projects: string[];
};

export type DraftedCommit = { message: string; paths: string[] };

export const gitSubcommands = [
  'add',
  'blame',
  'branch',
  'cat-file',
  'checkout',
  'commit',
  'diff',
  'for-each-ref',
  'hash-object',
  'init',
  'log',
  'ls-files',
  'merge',
  'mv',
  'push',
  'remote',
  'reset',
  'rev-list',
  'rev-parse',
  'show',
  'stash',
  'status',
  'switch',
  'worktree',
] as const;

export type GitSubcommand = (typeof gitSubcommands)[number];

export type Session = {
  fixture: Fixture;
  address: string;
  repository: string;
  projectHome: string;
  installation: string;
  projectId: string;
  worktreeId: string;
  send(request: HttpRequest): Promise<HttpResponse>;
  read(request: HttpRequest, status?: number): Promise<HttpResponse>;
  live(options?: LiveOptions): Promise<LiveConnection>;
  git(subcommand: GitSubcommand, ...args: string[]): Promise<string>;
  writeFile(path: string, content: string | Uint8Array): Promise<void>;
  readFile(path: string): Promise<string>;
  symlink(target: string, path: string): Promise<void>;
  fifo(path: string): Promise<void>;
  remove(path: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  entries(path: string): Promise<string[]>;
  installCodingTool(): Promise<void>;
  secret(value: string): void;
};

export type Hit = {
  method: string;
  route: string | undefined;
  path: string;
  kit: boolean;
  status: number | undefined;
};

export type ProofCheckStep = {
  name: string;
  result: 'pass' | 'fail' | 'skipped';
  output?: string;
};

export type AgentAction =
  | {
      kind: 'publish-review';
      title: string;
      step: 'changed' | 'context';
      summaryHtml?: string | undefined;
    }
  | {
      kind: 'publish-proof';
      title: string;
      checks: ProofCheckStep[];
      screenshot: string;
    }
  | { kind: 'comment'; path: string; body: string }
  | { kind: 'reply'; threadId: string; body: string }
  | { kind: 'edit-file'; edit: EditFileRequest };

export type Phase = 'setup' | 'request' | 'follow-up';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function record(value: unknown): Record<string, unknown> {
  if (isRecord(value)) return value;
  throw new Error(`Expected an object, got ${JSON.stringify(value)}`);
}

export function list(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  throw new Error(`Expected an array, got ${JSON.stringify(value)}`);
}

export function text(value: unknown): string {
  if (typeof value === 'string') return value;
  throw new Error(`Expected a string, got ${JSON.stringify(value)}`);
}
