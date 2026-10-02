import type { ApiErrorCode } from '@porcelain/contracts/shared';
import type {
  HttpRequest,
  HttpResponse,
  Phase,
  Session,
} from '../../../../apps/server/spec/kit/session.ts';

export type Intent = 'observed' | 'intended';

export type Budget = { p95Ms: number; gitProcesses: number };

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
  budget?: Budget;
  request: (session: Session, state: State) => HttpRequest | HttpRequest[];
  expect: (outcome: Outcome<State>) => Promise<void> | void;
};

export type Case<State = undefined> = CaseBody<State> & {
  setup: (session: Session) => Promise<State>;
};

export class UnassertedExchanges extends Error {}

export type CaseRunner = {
  enter(phase: Phase): void;
  checks: Checks;
};

class DefinedCase {
  readonly name: string;
  readonly budget: Budget | undefined;
  readonly #run: (session: Session, runner: CaseRunner) => Promise<void>;

  constructor(
    name: string,
    budget: Budget | undefined,
    run: (session: Session, runner: CaseRunner) => Promise<void>,
  ) {
    this.name = name;
    this.budget = budget;
    this.#run = run;
  }

  run(session: Session, runner: CaseRunner): Promise<void> {
    return this.#run(session, runner);
  }
}

export function isDefinedCase(value: unknown): value is DefinedCase {
  return value instanceof DefinedCase;
}

export type Feature = {
  feature: string;
  reaches: string | readonly string[];
  paired: boolean;
  intent: Intent;
  behaviour: string;
  locations?: readonly string[];
  sample?: 'perf';
  cases: readonly DefinedCase[];
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
}

export function defineCase(
  value: CaseBody<undefined> & { setup?: undefined },
): DefinedCase;
export function defineCase<State>(value: Case<State>): DefinedCase;
export function defineCase<State>(
  value: (CaseBody<undefined> & { setup?: undefined }) | Case<State>,
): DefinedCase {
  return new DefinedCase(value.name, value.budget, async (session, runner) => {
    runner.enter('setup');
    if (value.setup === undefined)
      return execute(value, undefined, session, runner);
    return execute(value, await value.setup(session), session, runner);
  });
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

export function apiError(
  statusCode: number,
  error: string,
  message: string,
  code?: ApiErrorCode,
) {
  return { statusCode, error, message, ...(code ? { code } : {}) };
}
export const invalidRequest = apiError(400, 'Bad Request', 'Invalid request');
export const unauthenticated = apiError(
  401,
  'Unauthorized',
  'Authentication required',
);
