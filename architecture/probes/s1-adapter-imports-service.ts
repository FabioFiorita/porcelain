import type { Probe } from '../probe.ts';

export default {
  decision: 'S1',
  plants:
    'new adapters/files/checked-worktree-access-reader.ts: CheckedWorktreeAccessReader implements WorktreeAccessReader by calling CheckWorktreeService from @porcelain/projects/services',
  gate: 'lint',
  rule: 'porcelain(adapters-never-import-services)',
  edits: [
    {
      kind: 'create',
      path: 'apps/server/src/adapters/files/checked-worktree-access-reader.ts',
      content: `import type { WorktreeCheck } from '@porcelain/kernel/models';
import type { WorktreeAccessReader } from '@porcelain/kernel/ports';
import type { CheckWorktreeService } from '@porcelain/projects/services';

export class CheckedWorktreeAccessReader implements WorktreeAccessReader {
  private readonly checkWorktree: CheckWorktreeService;

  constructor(checkWorktree: CheckWorktreeService) {
    this.checkWorktree = checkWorktree;
  }

  async known(
    input: { worktreeId: string },
    signal?: AbortSignal,
  ): Promise<WorktreeCheck> {
    const worktree = await this.checkWorktree.execute(
      { worktreeId: input.worktreeId },
      signal,
    );
    return { kind: 'found', worktree };
  }

  async forWriting(
    input: { worktreeId: string },
    signal?: AbortSignal,
  ): Promise<WorktreeCheck> {
    const worktree = await this.checkWorktree.execute(
      { worktreeId: input.worktreeId, purpose: 'writing' },
      signal,
    );
    return { kind: 'found', worktree };
  }
}
`,
    },
  ],
} satisfies Probe;
