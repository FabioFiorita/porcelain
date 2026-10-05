import type { Probe } from '../probe.ts';

export default {
  decision: 'H4',
  plants:
    'the text-file use case calls its IO service without WorktreeAccess admission',
  gate: 'arch',
  rule: 'worktree-use-case-checks:',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/use-cases/files/read-text-file.ts',
      old: `    return this.access.read(input.worktreeId, (worktree) =>
      this.readTextFile.execute({ ...input, worktreeId: worktree.id }),
    );`,
      new: `    return this.readTextFile.execute(input);`,
    },
  ],
} satisfies Probe;
