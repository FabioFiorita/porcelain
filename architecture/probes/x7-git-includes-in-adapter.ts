import type { Probe } from '../probe.ts';

export default {
  decision: 'X7',
  plants:
    "adapters/files/filesystem-directory-reader.ts skipping an entry with ['.git'].includes(name)",
  gate: 'lint',
  rule: 'porcelain(adapters-report-facts)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/adapters/files/filesystem-directory-reader.ts',
      old: `        if (found.length === input.limit) {`,
      new: `        if (['.git'].includes(name)) continue;
        if (found.length === input.limit) {`,
    },
  ],
} satisfies Probe;
