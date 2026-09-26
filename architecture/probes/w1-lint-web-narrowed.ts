import type { Probe } from '../probe.ts';

export default {
  decision: 'W1',
  plants:
    'lint:web back to a bare oxlint call, so the browser specs, the pinned config, the baseline and the React Compiler check escape it',
  gate: 'lint',
  rule: 'style(package-scripts)',
  edits: [
    {
      kind: 'replace',
      path: 'package.json',
      old: '"lint:web": "node scripts/style.ts lint web"',
      new: '"lint:web": "oxlint apps/web/src"',
    },
  ],
} satisfies Probe;
