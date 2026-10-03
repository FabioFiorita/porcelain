import type { Probe } from '../probe.ts';

export default {
  decision: 'S5',
  plants:
    'the desktop e2e script is replaced with a successful no-op, so Turborepo runs nothing for the desktop suite',
  gate: 'lint',
  rule: 'style(package-scripts)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/desktop/package.json',
      old: '"test:e2e": "playwright test"',
      new: '"test:e2e": "node -e 0"',
    },
  ],
} satisfies Probe;
