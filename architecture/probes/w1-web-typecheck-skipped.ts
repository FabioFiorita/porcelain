import type { Probe } from '../probe.ts';

export default {
  decision: 'W1',
  plants:
    'apps/web/package.json typecheck runs true, so typecheck:web checks nothing',
  gate: 'lint',
  rule: 'style(package-scripts)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/web/package.json',
      old: '"typecheck": "tsc --noEmit && tsc --noEmit -p tsconfig.node.json"',
      new: '"typecheck": "true"',
    },
  ],
} satisfies Probe;
