import type { Clock } from '@porcelain/kernel/ports';
import type { FailureReport, Logger } from '../../ports/logger.ts';

function described(error: unknown) {
  return error instanceof Error
    ? { name: error.name, message: error.message, stack: error.stack }
    : { name: typeof error, message: String(error) };
}

export class StderrLogger implements Logger {
  private readonly clock: Clock;

  constructor(clock: Clock) {
    this.clock = clock;
  }

  failure(input: FailureReport): void {
    const { error, ...fields } = input;
    process.stderr.write(
      `${JSON.stringify({ at: this.clock.now(), level: 'error', ...fields, error: described(error) })}\n`,
    );
  }
}
