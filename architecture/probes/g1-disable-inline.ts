import type { Probe } from '../probe.ts';

export default {
  decision: 'G1',
  plants:
    'files/services/list-directory-service.ts: an oxlint disable-next-line line comment for porcelain/no-exported-constants above a literal 2000',
  gate: 'lint',
  rule: 'porcelain(no-disable-directives)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/files/src/services/list-directory-service.ts',
      old: '        limit: this.options.maxEntries + 1,',
      new: `        ${'//'} oxlint-disable-next-line porcelain/no-exported-constants
        limit: Math.min(this.options.maxEntries, 2000) + 1,`,
    },
  ],
} satisfies Probe;
