import type { Probe } from '../probe.ts';

export default {
  decision: 'H3',
  plants:
    'use-cases/git-actions/run-git-action.ts publishes from inside a lanes.finish callback through a private method that is not a live-progress publisher',
  gate: 'lint',
  rule: 'porcelain(events-after-lane)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/use-cases/git-actions/run-git-action.ts',
      old: `this.lanes.finish(async () => this.abandon(run, error), {`,
      new: `this.lanes.finish(async () => this.announceAbandon(run, error), {`,
    },
    {
      kind: 'replace',
      path: 'apps/server/src/use-cases/git-actions/run-git-action.ts',
      old: `  private abandon(run: GitActionRun, error: unknown): void {`,
      new: `  private announceAbandon(run: GitActionRun, error: unknown): void {
    this.events.gitActionChanged(this.interruptGitAction.execute({ requestId: run.requestId }));
    this.abandon(run, error);
  }

  private abandon(run: GitActionRun, error: unknown): void {`,
    },
  ],
} satisfies Probe;
