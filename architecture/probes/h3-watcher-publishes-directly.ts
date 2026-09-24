import type { Probe } from '../probe.ts';

export default {
  decision: 'H3',
  plants:
    'runtime/live-updates/watch-worktrees.ts takes the EventPublisher again and announces a Git change itself instead of through the use case',
  gate: 'lint',
  rule: 'porcelain(events-from-use-cases)',
  edits: [
    {
      kind: 'prepend',
      path: 'apps/server/src/runtime/live-updates/watch-worktrees.ts',
      content: `import type { EventPublisher } from '../../ports/event-publisher.ts';
`,
    },
    {
      kind: 'replace',
      path: 'apps/server/src/runtime/live-updates/watch-worktrees.ts',
      old: `  private announceChange(change: WorktreeChange): void {`,
      new: `  private publish(events: EventPublisher, worktreeId: string): void {
    events.worktreeChanged({ worktreeId, change: 'git' });
  }

  private announceChange(change: WorktreeChange): void {`,
    },
  ],
} satisfies Probe;
