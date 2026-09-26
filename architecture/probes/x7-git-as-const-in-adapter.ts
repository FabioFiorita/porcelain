import type { Probe } from '../probe.ts';

export default {
  decision: 'X7',
  plants:
    "adapters/files/filesystem-directory-reader.ts comparing the name with HIDDEN = '.git' as const",
  gate: 'lint',
  rule: 'porcelain(adapters-report-facts)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/adapters/files/filesystem-directory-reader.ts',
      old: `        if (found.length === input.limit) {`,
      new: `        if (name === HIDDEN) continue;
        if (found.length === input.limit) {`,
    },
    {
      kind: 'prepend',
      path: 'apps/server/src/adapters/files/filesystem-directory-reader.ts',
      content: `const HIDDEN = '.git' as const;
`,
    },
  ],
} satisfies Probe;
