import type { Probe } from '../probe.ts';

export default {
  decision: 'H4',
  plants:
    'use-cases/files/read-text-file.ts reads the file for its worktreeId without resolving the worktree through checkWorktree',
  gate: 'arch',
  rule: 'worktree-use-case-checks:',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/use-cases/files/read-text-file.ts',
      old: `    const worktree = await this.checkWorktree.execute(
      { worktreeId: input.worktreeId, requireAvailableProject: false },
      context,
    );
    return this.lanes.runConsistent(
      this.laneKeys.repository(worktree),
      worktree,
      async ({ signal }) => {
        const result = await this.readTextFile.execute(input, signal);
        return result;
      },
      { callerSignal: context.signal },
    );`,
      new: `    return this.lanes.unqueued(
      async (signal) => this.readTextFile.execute(input, signal),
      { callerSignal: context.signal },
    );`,
    },
  ],
} satisfies Probe;
