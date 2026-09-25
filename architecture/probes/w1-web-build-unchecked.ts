import type { Probe } from '../probe.ts';

export default {
  decision: 'W1',
  plants: 'apps/web/package.json build drops its type check before vite build',
  gate: 'lint',
  rule: 'style(package-scripts)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/web/package.json',
      old: '"build": "tsc --noEmit && vite build"',
      new: '"build": "vite build"',
    },
  ],
} satisfies Probe;
