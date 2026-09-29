import type {
  TailnetServeOutcome,
  TailnetServeTarget,
} from '@porcelain/access/models';
import type { TailnetServeRunner } from '@porcelain/access/ports';
import {
  runTailscale,
  type TailscaleLimits,
  type TailscaleRun,
} from './tailscale-command.ts';

function outcome(run: TailscaleRun): TailnetServeOutcome {
  if (run.kind === 'done') return { kind: 'done' };
  return run.kind === 'failed' && run.denied
    ? { kind: 'denied' }
    : { kind: 'failed' };
}

export class ProcessTailnetServeRunner implements TailnetServeRunner {
  private readonly limits: TailscaleLimits;

  constructor(limits: TailscaleLimits) {
    this.limits = limits;
  }

  async serve(
    input: TailnetServeTarget,
    signal?: AbortSignal,
  ): Promise<TailnetServeOutcome> {
    return outcome(
      await runTailscale(
        ['serve', '--bg', `--https=${this.limits.httpsPort}`, input.target],
        this.limits,
        signal,
      ),
    );
  }

  async stop(
    _input: TailnetServeTarget,
    signal?: AbortSignal,
  ): Promise<TailnetServeOutcome> {
    return outcome(
      await runTailscale(
        ['serve', `--https=${this.limits.httpsPort}`, 'off'],
        this.limits,
        signal,
      ),
    );
  }
}
