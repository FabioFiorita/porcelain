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
      old: 'return yield* accessCapability.read(input.worktreeId, (worktree) =>\n            readTextFileCapability.execute({\n              ...input,\n              worktreeId: worktree.id,\n            }),\n          );',
      new: 'return yield* readTextFileCapability.execute(input);',
    },
  ],
} satisfies Probe;
