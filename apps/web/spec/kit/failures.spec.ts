import { expect, it } from 'vitest';
import { createFailures, failureMessage } from './failures.ts';
import type { BrowserFailure, ServerHit } from './protocol.ts';

function hit(
  status: number | undefined,
  route = '/probe/inventory',
  kit = false,
  method = 'GET',
): ServerHit {
  return { method, route, path: route, kit, status };
}

type Case = {
  name: string;
  console?: RegExp;
  response?: { route: string; status: number };
  accepted?: string[];
  observed?: BrowserFailure[];
  hits?: ServerHit[];
  expected: string[];
};

it.each<Case>([
  { name: 'no failures and no server', expected: [] },
  {
    name: 'an expected console error',
    console: /offline/,
    observed: [{ kind: 'console error', message: 'offline' }],
    expected: [],
  },
  {
    name: 'an unexpected console error',
    observed: [{ kind: 'console error', message: 'offline' }],
    expected: ['console error: offline'],
  },
  {
    name: 'an uncaught error cannot satisfy a console declaration',
    console: /offline/,
    observed: [{ kind: 'uncaught error', message: 'offline' }],
    expected: [
      'uncaught error: offline',
      'declared console error /offline/ never happened',
    ],
  },
  {
    name: 'an unhandled rejection',
    observed: [{ kind: 'unhandled rejection', message: 'offline' }],
    expected: ['unhandled rejection: offline'],
  },
  {
    name: 'a missing console error',
    console: /offline/,
    expected: ['declared console error /offline/ never happened'],
  },
  {
    name: 'an empty console message',
    observed: [{ kind: 'console error', message: '' }],
    expected: ['console error: '],
  },
  {
    name: 'a long console message stays intact',
    observed: [
      {
        kind: 'console error',
        message:
          'The reader could not reach its disposable server after the connection closed while a pending response was being delivered; retain the entire diagnostic including its final recovery instruction: reconnect and read the project again.',
      },
    ],
    expected: [
      'console error: The reader could not reach its disposable server after the connection closed while a pending response was being delivered; retain the entire diagnostic including its final recovery instruction: reconnect and read the project again.',
    ],
  },
  {
    name: 'an expected HTTP failure',
    response: { route: 'GET /probe/inventory', status: 503 },
    hits: [hit(503)],
    expected: [],
  },
  {
    name: 'an unexpected HTTP failure',
    hits: [hit(500)],
    expected: ['server answered GET /probe/inventory with 500'],
  },
  {
    name: 'a missing HTTP failure',
    response: { route: 'GET /probe/inventory', status: 503 },
    expected: ['declared 503 from GET /probe/inventory never happened'],
  },
  {
    name: 'a different HTTP status',
    response: { route: 'GET /probe/inventory', status: 503 },
    hits: [hit(500)],
    expected: [
      'server answered GET /probe/inventory with 500',
      'declared 503 from GET /probe/inventory never happened',
    ],
  },
  {
    name: 'a different HTTP route',
    response: { route: 'GET /probe/other', status: 500 },
    hits: [hit(500)],
    expected: [
      'server answered GET /probe/inventory with 500',
      'declared 500 from GET /probe/other never happened',
    ],
  },
  {
    name: 'a different HTTP method',
    response: { route: 'POST /probe/inventory', status: 500 },
    hits: [hit(500)],
    expected: [
      'server answered GET /probe/inventory with 500',
      'declared 500 from POST /probe/inventory never happened',
    ],
  },
  {
    name: 'a kit failure cannot satisfy a product declaration',
    response: { route: 'GET /probe/inventory', status: 500 },
    hits: [hit(500, '/probe/inventory', true)],
    expected: ['declared 500 from GET /probe/inventory never happened'],
  },
  {
    name: 'successful, client-error, kit and incomplete responses',
    hits: [hit(200), hit(404), hit(500, '/probe/health', true), hit(undefined)],
    expected: [],
  },
  {
    name: 'a response without a matched route uses its path',
    hits: [{ ...hit(502), route: undefined, path: '/probe/raw' }],
    expected: ['server answered GET /probe/raw with 502'],
  },
  {
    name: 'mixed declared, undeclared and kit 5xx responses',
    response: { route: 'POST /probe/actions', status: 503 },
    hits: [
      hit(503, '/probe/actions', false, 'POST'),
      hit(500),
      hit(502, '/probe/health', true),
    ],
    expected: ['server answered GET /probe/inventory with 500'],
  },
  {
    name: 'accepting one report leaves other failures visible',
    accepted: ['console error: accepted'],
    observed: [
      { kind: 'console error', message: 'accepted' },
      { kind: 'console error', message: 'accepted suffix' },
    ],
    expected: ['console error: accepted suffix'],
  },
  {
    name: 'an accepted missing declaration does not hide a server failure',
    console: /offline/,
    accepted: ['declared console error /offline/ never happened'],
    hits: [hit(500)],
    expected: ['server answered GET /probe/inventory with 500'],
  },
  {
    name: 'multiple matching console errors and responses',
    console: /offline/,
    response: { route: 'GET /probe/inventory', status: 503 },
    observed: [
      { kind: 'console error', message: 'offline' },
      { kind: 'console error', message: 'offline again' },
    ],
    hits: [hit(503), hit(503), hit(500), hit(500)],
    expected: [
      'server answered GET /probe/inventory with 500',
      'server answered GET /probe/inventory with 500',
    ],
  },
])('$name', ({ console, response, accepted, observed, hits, expected }) => {
  const failures = createFailures();
  if (console) failures.console(console);
  if (response) failures.response(response.route, response.status);
  failures.accept(accepted ?? []);
  expect(failures.unexpected(observed ?? [], hits ?? [])).toEqual(expected);
});

it('rechecks late failures and keeps satisfied declarations across reports', () => {
  const failures = createFailures();
  failures.console(/offline/);
  expect(failures.unexpected([], [])).toEqual([
    'declared console error /offline/ never happened',
  ]);
  expect(
    failures.unexpected([{ kind: 'console error', message: 'offline' }], []),
  ).toEqual([]);
  expect(failures.unexpected([], [hit(500)])).toEqual([
    'server answered GET /probe/inventory with 500',
  ]);
});

it('keeps declarations and accepted reports local to each test case', () => {
  const first = createFailures();
  first.console(/offline/);
  first.accept(['console error: other']);
  const second = createFailures();
  const observed: BrowserFailure[] = [
    { kind: 'console error', message: 'offline' },
    { kind: 'console error', message: 'other' },
  ];
  expect(first.unexpected(observed, [])).toEqual([]);
  expect(second.unexpected(observed, [])).toEqual([
    'console error: offline',
    'console error: other',
  ]);
});

it('includes the test name and every observed failure in the rejection', () => {
  expect(
    failureMessage('reader journey', [
      'console error: offline',
      'server answered GET /probe/inventory with 500',
    ]),
  ).toBe(
    '"reader journey" met failures it did not declare through failures.console or failures.response: console error: offline; server answered GET /probe/inventory with 500',
  );
});
