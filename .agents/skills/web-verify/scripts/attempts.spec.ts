import { expect, it } from 'vitest';
import { type Attempted, captureOnceMore } from './attempts.ts';

type Outcome = { problems?: string[]; throws?: string };

function scripted(shot: Attempted, outcomes: readonly Outcome[]) {
  let calls = 0;
  const capture = async () => {
    const outcome = outcomes[calls] ?? {};
    calls += 1;
    shot.problems.push(...(outcome.problems ?? []));
    if (outcome.throws !== undefined)
      throw new Error(`${outcome.throws}\nCall log:\n  - navigating`);
  };
  return { capture, calls: () => calls };
}

it.each<{
  name: string;
  outcomes: Outcome[];
  calls: number;
  problems: string[];
  retried?: string;
}>([
  {
    name: 'a clean capture runs once',
    outcomes: [{}],
    calls: 1,
    problems: [],
  },
  {
    name: 'a console error that reads like a crash is a problem, never a retry',
    outcomes: [
      {
        problems: [
          'console error: Target crashed: the review socket has been closed',
        ],
      },
    ],
    calls: 1,
    problems: [
      'console error: Target crashed: the review socket has been closed',
    ],
  },
  {
    name: 'a capture that fails for another reason is not retried',
    outcomes: [
      { throws: 'page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1/' },
    ],
    calls: 1,
    problems: [
      'not captured: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1/',
    ],
  },
  {
    name: 'a renderer crash is retried once, logged, and keeps the first attempt’s problems',
    outcomes: [
      {
        problems: ['console error: socket closed'],
        throws: 'page.evaluate: Target crashed',
      },
      {},
    ],
    calls: 2,
    problems: ['attempt 1: console error: socket closed'],
    retried: 'retried once after: page.evaluate: Target crashed',
  },
  {
    name: 'a browser out of resources is retried once',
    outcomes: [
      { throws: 'page.goto: net::ERR_INSUFFICIENT_RESOURCES at http://x/' },
      {},
    ],
    calls: 2,
    problems: [],
    retried:
      'retried once after: page.goto: net::ERR_INSUFFICIENT_RESOURCES at http://x/',
  },
  {
    name: 'a second crash fails the capture and names the crash',
    outcomes: [
      { throws: 'page.goto: Page crashed' },
      { throws: 'page.screenshot: Target crashed' },
    ],
    calls: 2,
    problems: [
      'not captured: page.screenshot: Target crashed; the browser crashed on both attempts, so check free memory and sweep again',
    ],
    retried: 'retried once after: page.goto: Page crashed',
  },
  {
    name: 'a different failure after a crash is reported as itself',
    outcomes: [
      { throws: 'page.goto: Page crashed' },
      { problems: ['page error: boom'], throws: 'page.goto: Timeout 30000ms' },
    ],
    calls: 2,
    problems: ['page error: boom', 'not captured: page.goto: Timeout 30000ms'],
    retried: 'retried once after: page.goto: Page crashed',
  },
])('$name', async ({ outcomes, calls, problems, retried }) => {
  const shot: Attempted = { problems: [] };
  const run = scripted(shot, outcomes);

  await captureOnceMore(shot, run.capture);

  expect(run.calls()).toBe(calls);
  expect(shot.problems).toStrictEqual(problems);
  expect(shot.retried).toBe(retried);
});
