import type { Probe } from '../probe.ts';

export default {
  decision: 'W1',
  plants:
    'lint:web narrowed so the browser specs under apps/web/spec escape lint',
  gate: 'lint',
  rule: 'style(package-scripts)',
  edits: [
    {
      kind: 'replace',
      path: 'package.json',
      old: '"lint:web": "oxlint apps/web/src apps/web/spec apps/web/vite.config.ts"',
      new: '"lint:web": "oxlint apps/web/src apps/web/vite.config.ts"',
    },
  ],
} satisfies Probe;
