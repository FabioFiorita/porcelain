import type { Probe } from '../probe.ts';

export default {
  decision: 'H3',
  plants:
    'use-cases/git-actions/run-git-action.ts publishes a Git change from targetChanges, which runs inside lanes.background and is not a live-progress publisher',
  gate: 'lint',
  rule: 'porcelain(events-after-lane)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/use-cases/git-actions/run-git-action.ts',
      old: `    if (run.target.kind === 'unchecked') return [];`,
      new: `    this.events.worktreeChanged({ worktreeId: run.worktreeId, change: 'git' });
    if (run.target.kind === 'unchecked') return [];`,
    },
  ],
} satisfies Probe;
