import type { Probe } from '../probe.ts';

export default {
  decision: 'C1',
  plants:
    'use-cases/projects/find-worktree-by-path.ts refuses a path with Promise.reject(new NoWorktreeAtPathError()) instead of the service',
  gate: 'lint',
  rule: 'porcelain(use-case-computes)',
  edits: [
    {
      kind: 'prepend',
      path: 'apps/server/src/use-cases/projects/find-worktree-by-path.ts',
      content: `import { NoWorktreeAtPathError } from '@porcelain/projects/errors';
`,
    },
    {
      kind: 'replace',
      path: 'apps/server/src/use-cases/projects/find-worktree-by-path.ts',
      old: `    await this.refreshInventory.execute(context);`,
      new: `    if (input.path === '') return Promise.reject(new NoWorktreeAtPathError());
    await this.refreshInventory.execute(context);`,
    },
  ],
} satisfies Probe;
