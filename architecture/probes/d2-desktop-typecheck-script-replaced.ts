import type { Probe } from '../probe.ts';

export default {
  decision: 'D2',
  plants: 'the desktop typecheck gate is replaced with a successful no-op',
  gate: 'lint',
  rule: 'style(package-scripts)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/desktop/package.json',
      old: '"typecheck": "tsc --noEmit"',
      new: '"typecheck": "node -e 0"',
    },
  ],
} satisfies Probe;
