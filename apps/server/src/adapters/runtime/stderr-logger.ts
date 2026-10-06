import { type Clock, DateTime } from 'effect';
import type { FailureReport, Logger } from '../../ports/logger.ts';

function described(error: unknown) {
  return error instanceof Error
    ? { name: error.name, message: error.message, stack: error.stack }
    : { name: typeof error, message: String(error) };
}

export class StderrLogger implements Logger {
  private readonly clock: Clock.Clock;

  constructor(clock: Clock.Clock) {
    this.clock = clock;
  }

  failure(input: FailureReport): void {
    const { error, ...fields } = input;
    process.stderr.write(
      `${JSON.stringify({ at: DateTime.formatIso(DateTime.makeUnsafe(this.clock.currentTimeMillisUnsafe())), level: 'error', ...fields, error: described(error) })}\n`,
    );
  }
}
