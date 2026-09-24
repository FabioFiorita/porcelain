import type { Probe } from '../probe.ts';

export default {
  decision: 'C2',
  plants:
    'projects/services/collect-absent-worktrees-service.ts: execute(input: Record<never, never>) with `void input;` (callers pass {})',
  gate: 'lint',
  rule: 'porcelain(operation-class-shape)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/projects/src/services/collect-absent-worktrees-service.ts',
      old: `  execute(): CollectAbsentWorktreesResult {
`,
      new: `  execute(input: Record<never, never>): CollectAbsentWorktreesResult {
    void input;
`,
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
