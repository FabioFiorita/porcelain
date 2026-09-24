import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants:
    'use-cases/files/list-directory.ts picks a lane key before resolving the worktree with checkWorktree',
  gate: 'lint',
  rule: 'porcelain(lane-after-check)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/use-cases/files/list-directory.ts',
      old: '    const worktree = await this.checkWorktree.execute(',
      new: '    const early = this.laneKeys.filesystem();\n    const worktree = await this.checkWorktree.execute(',
    },
  ],
} satisfies Probe;
