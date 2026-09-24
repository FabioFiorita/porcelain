import type { Probe } from '../probe.ts';

export default {
  decision: 'S6',
  plants:
    'adapters/files/filesystem-directory-reader.ts: `if (found.length >= 2000)` replaces input.limit (a hard-coded limit decided in the adapter)',
  gate: 'lint',
  rule: 'porcelain(no-number-outside-limits)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/adapters/files/filesystem-directory-reader.ts',
      old: 'if (found.length === input.limit) {',
      new: 'if (found.length >= 2000) {',
    },
  ],
} satisfies Probe;
