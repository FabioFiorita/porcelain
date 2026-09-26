import type { Probe } from '../probe.ts';

export default {
  decision: 'EVASION',
  plants:
    'architecture/oxlint-plugin.mjs: a // comment above the domainPackage constant',
  gate: 'lint',
  rule: 'porcelain(no-comments)',
  edits: [
    {
      kind: 'replace',
      path: 'architecture/oxlint-plugin.mjs',
      old: 'const domainPackage =',
      new: `// the six domain packages
const domainPackage =`,
    },
  ],
} satisfies Probe;
