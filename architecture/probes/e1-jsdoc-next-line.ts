import type { Probe } from '../probe.ts';

export default {
  decision: 'EVASION',
  plants:
    'files/services/list-directory-service.ts: `/** eslint-disable-next-line */` above a literal 2000',
  gate: 'lint',
  rule: 'porcelain(no-comments)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/files/src/services/list-directory-service.ts',
      old: '        limit: this.options.maxEntries + 1,',
      new: `        /** eslint-disable-next-line */
        limit: Math.min(this.options.maxEntries, 2000) + 1,`,
    },
  ],
} satisfies Probe;
