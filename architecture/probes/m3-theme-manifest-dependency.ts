import type { Probe } from '../probe.ts';

export default {
  decision: 'M3',
  plants:
    'the CSS-only theme acquires a runtime dependency without a typecheck',
  gate: 'arch',
  rule: 'theme-data-only:',
  edits: [
    {
      kind: 'replace',
      path: 'packages/theme/package.json',
      old: '"private": true,',
      new: '"private": true, "dependencies": { "react": "*" },',
    },
  ],
} satisfies Probe;
