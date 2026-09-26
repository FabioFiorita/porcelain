import type { Probe } from '../probe.ts';

export default {
  decision: 'C2',
  plants:
    'projects/services/list-expired-worktrees-service.ts: execute(input: Record<never, never>) used via `const {} = input;` (no void)',
  gate: 'lint',
  rule: 'porcelain(operation-class-shape)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/projects/src/services/list-expired-worktrees-service.ts',
      old: `  execute(): RecordedWorktreesResult {
`,
      new: `  execute(input: Record<never, never>): RecordedWorktreesResult {
    const now = Object.keys(input).length === 0 ? this.clock.now() : this.clock.now();
`,
    },
    {
      kind: 'replace',
      path: 'packages/projects/src/services/list-expired-worktrees-service.ts',
      old: `expired(rows, this.clock.now(), this.options.graceMs)`,
      new: `expired(rows, now, this.options.graceMs)`,
    },
    {
      kind: 'replace',
      path: 'packages/projects/src/services/list-expired-worktrees-service.spec.ts',
      old: '.execute(),',
      new: '.execute({}),',
      all: true,
    },
    {
      kind: 'replace',
      path: 'apps/server/src/use-cases/projects/collect-absent-worktrees.ts',
      old: 'this.listExpiredWorktrees.execute()',
      new: 'this.listExpiredWorktrees.execute({})',
    },
  ],
} satisfies Probe;
