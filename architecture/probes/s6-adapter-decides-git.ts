import type { Probe } from '../probe.ts';

export default {
  decision: 'S6',
  plants:
    "adapters/files/filesystem-directory-reader.ts: `if (name.toLowerCase() === '.git') continue;` inside the listing loop",
  gate: 'lint',
  rule: 'porcelain(adapters-report-facts)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/adapters/files/filesystem-directory-reader.ts',
      old: '        if (found.length === input.limit) {',
      new: `        if (name.toLowerCase() === '.git') continue;
        if (found.length === input.limit) {`,
    },
  ],
} satisfies Probe;
