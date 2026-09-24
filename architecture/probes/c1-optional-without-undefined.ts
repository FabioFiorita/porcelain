import type { Probe } from '../probe.ts';

export default {
  decision: 'C1',
  plants:
    'files/models/list-directory.ts: `cursor?: string;` added to ListDirectoryInput',
  gate: 'lint',
  rule: 'porcelain(models-file-shape)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/files/src/models/list-directory.ts',
      old: `  path: string;
};`,
      new: `  path: string;
  cursor?: string;
};`,
    },
  ],
} satisfies Probe;
