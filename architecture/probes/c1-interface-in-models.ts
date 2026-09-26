import type { Probe } from '../probe.ts';

export default {
  decision: 'C1',
  plants:
    'files/models/list-directory.ts: ListDirectoryInput written as an interface',
  gate: 'lint',
  rule: 'porcelain(interfaces-only-in-ports)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/files/src/models/list-directory.ts',
      old: `export type ListDirectoryInput = {
  worktreeId: string;
  path: string;
};`,
      new: `export interface ListDirectoryInput {
  worktreeId: string;
  path: string;
}`,
    },
  ],
} satisfies Probe;
