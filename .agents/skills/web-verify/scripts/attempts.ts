const browserCrashed =
  /Target crashed|Page crashed|ERR_INSUFFICIENT_RESOURCES|ERR_OUT_OF_MEMORY|ENOMEM/;

export type Attempted = { problems: string[]; retried?: string };

export function firstLine(error: unknown) {
  return error instanceof Error
    ? (error.message.split('\n')[0] ?? '')
    : String(error);
}

function failure(capture: () => Promise<void>) {
  return capture().then(() => undefined, firstLine);
}

export async function captureOnceMore(
  shot: Attempted,
  capture: () => Promise<void>,
): Promise<void> {
  const first = await failure(capture);
  if (first === undefined) return;
  if (!browserCrashed.test(first)) {
    shot.problems.push(`not captured: ${first}`);
    return;
  }
  shot.retried = `retried once after: ${first}`;
  shot.problems = shot.problems.map((problem) => `attempt 1: ${problem}`);
  const second = await failure(capture);
  if (second !== undefined)
    shot.problems.push(
      `not captured: ${second}${browserCrashed.test(second) ? '; the browser crashed on both attempts, so check free memory and sweep again' : ''}`,
    );
}
