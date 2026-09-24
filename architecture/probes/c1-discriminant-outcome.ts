import type { Probe } from '../probe.ts';

export default {
  decision: 'C1',
  plants:
    'files/models/list-directory.ts: union ListDirectoryOutcome discriminated on `outcome`',
  gate: 'lint',
  rule: 'porcelain(models-file-shape)',
  edits: [
    {
      kind: 'append',
      path: 'packages/files/src/models/list-directory.ts',
      content: `
export type ListDirectoryOutcome =
  | { outcome: 'listed'; entries: DirectoryEntry[] }
  | { outcome: 'too-large' };
`,
    },
  ],
} satisfies Probe;
