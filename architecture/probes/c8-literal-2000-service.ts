import type { Probe } from '../probe.ts';

export default {
  decision: 'C8',
  plants:
    'files/services/list-directory-service.ts: limit: Math.min(this.options.maxEntries, 2000) + 1',
  gate: 'lint',
  rule: 'porcelain(no-number-outside-limits)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/files/src/services/list-directory-service.ts',
      old: '        limit: this.options.maxEntries + 1,',
      new: '        limit: Math.min(this.options.maxEntries, 2000) + 1,',
    },
  ],
} satisfies Probe;
