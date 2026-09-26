import type { Probe } from '../probe.ts';

export default {
  decision: 'S2',
  plants:
    'packages/kernel/src/models/worktree.ts: export function worktreeFound(check)',
  gate: 'lint',
  rule: 'porcelain(kernel-is-types)',
  edits: [
    {
      kind: 'append',
      path: 'packages/kernel/src/models/worktree.ts',
      content: `
export function worktreeFound(check: WorktreeCheck): boolean {
  return check.kind === 'found';
}
`,
    },
  ],
} satisfies Probe;
