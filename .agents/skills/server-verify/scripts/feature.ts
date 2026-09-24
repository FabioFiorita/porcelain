export type Intent = 'observed' | 'intended';

export type HttpRequest = {
  method: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  query?: Record<string, string | number | boolean>;
  body?: unknown;
  rawBody?: string;
  contentType?: string;
  headers?: Record<string, string>;
  auth?: 'paired' | 'none' | { bearer: string } | { cookie: string };
  target?: 'network' | 'owner';
};

export type HttpResponse = {
  status: number;
  headers: Record<string, string>;
  body: unknown;
};

export type LiveConnection = {
  send(message: unknown): void;
  next(
    accept: (notice: Record<string, unknown>) => boolean,
    timeoutMs?: number,
  ): Promise<Record<string, unknown>>;
  closed(timeoutMs?: number): Promise<{ code: number; reason: string }>;
  close(): void;
};

export type Fixture = {
  folders: { home: string; repository: string; state: string; web: string };
  branch: string;
  device: { label: string; platform: string };
  readme: { path: string; committed: string; changed: string };
  initialCommit: string;
  web: { shell: string; asset: { path: string; text: string }; escape: string };
  summaryLinkLifetimeMs: number;
};

export type Session = {
  fixture: Fixture;
  address: string;
  repository: string;
  projectHome: string;
  projectId: string;
  worktreeId: string;
  send(request: HttpRequest): Promise<HttpResponse>;
  read(request: HttpRequest, status?: number): Promise<HttpResponse>;
  live(): Promise<LiveConnection>;
  git(...args: string[]): Promise<string>;
  writeFile(path: string, content: string | Uint8Array): Promise<void>;
  readFile(path: string): Promise<string>;
  symlink(target: string, path: string): Promise<void>;
  entries(path: string): Promise<string[]>;
  secret(value: string): void;
};

export type ContractSchema = {
  safeParse(value: unknown): {
    success: boolean;
    error?: { issues: readonly unknown[] };
  };
};

export type Checks = {
  check: (name: string, expected: unknown, actual: unknown) => void;
  checkPartial: (name: string, expected: unknown, actual: unknown) => void;
  checkContract: (
    name: string,
    schema: ContractSchema,
    actual: unknown,
  ) => void;
  checkMatch: (name: string, pattern: RegExp, actual: unknown) => void;
  checkDiffers: (name: string, previous: unknown, actual: unknown) => void;
};

export type Outcome<State> = Checks & {
  response: HttpResponse;
  responses: HttpResponse[];
  state: State;
  session: Session;
};

type CaseBody<State> = {
  name: string;
  request: (session: Session, state: State) => HttpRequest | HttpRequest[];
  expect: (outcome: Outcome<State>) => Promise<void> | void;
};

export type Case<State = undefined> = CaseBody<State> & {
  setup: (session: Session) => Promise<State>;
};

export type Phase = 'setup' | 'request' | 'follow-up';

export type CaseRunner = {
  enter(phase: Phase): void;
  checks: Checks;
  problems(): string[];
};

export type RunnableCase = {
  name: string;
  run(session: Session, runner: CaseRunner): Promise<void>;
};

export type Feature = {
  feature: string;
  reaches: string | readonly string[];
  paired: boolean;
  intent: Intent;
  behaviour: string;
  locations?: readonly string[];
  cases: readonly RunnableCase[];
};

async function execute<State>(
  value: CaseBody<State>,
  state: State,
  session: Session,
  runner: CaseRunner,
) {
  runner.enter('request');
  const planned = value.request(session, state);
  const responses: HttpResponse[] = [];
  for (const request of Array.isArray(planned) ? planned : [planned])
    responses.push(await session.send(request));
  const response = responses.at(-1);
  if (!response) throw new Error('The case sent no request');
  runner.enter('follow-up');
  await value.expect({
    ...runner.checks,
    response,
    responses,
    state,
    session,
  });
  const problems = runner.problems();
  if (problems.length > 0) throw new Error(problems.join('; '));
}

export function defineCase(
  value: CaseBody<undefined> & { setup?: undefined },
): RunnableCase;
export function defineCase<State>(value: Case<State>): RunnableCase;
export function defineCase<State>(
  value: (CaseBody<undefined> & { setup?: undefined }) | Case<State>,
): RunnableCase {
  return {
    name: value.name,
    async run(session, runner) {
      runner.enter('setup');
      if (value.setup === undefined)
        return execute(value, undefined, session, runner);
      return execute(value, await value.setup(session), session, runner);
    },
  };
}

export function defineFeature(value: Feature): Feature {
  return value;
}

export function upgradeHeaders(address: string): Record<string, string> {
  return {
    connection: 'Upgrade',
    upgrade: 'websocket',
    'sec-websocket-version': '13',
    'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==',
    origin: new URL(address).origin,
  };
}

export const unknownUuid = '00000000-0000-4000-8000-000000000000';
export const unknownWorktreeId = '0'.repeat(32);
export const unknownOid = '0'.repeat(40);
export const unknownFingerprint = '0'.repeat(64);

export function apiError(statusCode: number, error: string, message: string) {
  return { statusCode, error, message };
}
export const invalidRequest = apiError(400, 'Bad Request', 'Invalid request');
export const unauthenticated = apiError(
  401,
  'Unauthorized',
  'Authentication required',
);

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
