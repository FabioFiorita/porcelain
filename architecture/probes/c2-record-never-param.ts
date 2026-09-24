import type { Probe } from '../probe.ts';

export default {
  decision: 'C2',
  plants:
    'projects/services/collect-absent-worktrees-service.ts: execute(input: Record<never, never>) used via `const {} = input;` (no void)',
  gate: 'lint',
  rule: 'porcelain(operation-class-shape)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/projects/src/services/collect-absent-worktrees-service.ts',
      old: `  execute(): CollectAbsentWorktreesResult {
`,
      new: `  execute(input: Record<never, never>): CollectAbsentWorktreesResult {
    const now = Object.keys(input).length === 0 ? this.clock.now() : this.clock.now();
`,
    },
    {
      kind: 'replace',
      path: 'packages/projects/src/services/collect-absent-worktrees-service.ts',
      old: `      this.clock.now(),
      this.options.graceMs,`,
      new: `      now,
      this.options.graceMs,`,
    },
    {
      kind: 'replace',
      path: 'packages/projects/src/services/collect-absent-worktrees-service.spec.ts',
      old: 'service.execute()',
      new: 'service.execute({})',
      all: true,
    },
    {
      kind: 'replace',
      path: 'apps/server/src/use-cases/projects/collect-absent-worktrees.ts',
      old: 'this.collectAbsentWorktrees.execute()',
      new: 'this.collectAbsentWorktrees.execute({})',
    },
  ],
} satisfies Probe;
