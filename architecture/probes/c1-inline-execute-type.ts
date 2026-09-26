import type { Probe } from '../probe.ts';

export default {
  decision: 'C1',
  plants:
    'files/services/list-directory-service.ts: execute(input: { worktreeId: string; path: string }, ...)',
  gate: 'lint',
  rule: 'porcelain(no-inline-execute-types)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/files/src/services/list-directory-service.ts',
      old: `    input: ListDirectoryInput,
    signal?: AbortSignal,`,
      new: `    input: { worktreeId: string; path: string },
    signal?: AbortSignal,`,
    },
  ],
} satisfies Probe;
