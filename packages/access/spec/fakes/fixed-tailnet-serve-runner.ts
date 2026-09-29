import type { TailnetServeOutcome } from '../../src/models/remote-access.ts';
import type { TailnetServeRunner } from '../../src/ports/tailnet-serve-runner.ts';

export class FixedTailnetServeRunner implements TailnetServeRunner {
  private readonly outcome: TailnetServeOutcome;

  constructor(outcome: TailnetServeOutcome) {
    this.outcome = outcome;
  }

  async serve(): Promise<TailnetServeOutcome> {
    return this.outcome;
  }

  async stop(): Promise<TailnetServeOutcome> {
    return this.outcome;
  }
}
