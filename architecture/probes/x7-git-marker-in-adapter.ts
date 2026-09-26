import type { Probe } from '../probe.ts';

export default {
  decision: 'X7',
  plants:
    'adapters/files/filesystem-directory-reader.ts names the .git folder itself instead of taking it from its options',
  gate: 'lint',
  rule: 'porcelain(adapters-report-facts)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/adapters/files/filesystem-directory-reader.ts',
      old: 'lstat(join(full, gitDirectory))',
      new: "lstat(join(full, '.git'))",
    },
  ],
} satisfies Probe;
