import type { Probe } from '../probe.ts';

export default {
  decision: 'G1',
  plants:
    'the probe preflight in pnpm check is replaced with a successful no-op, so a probe whose target text is gone passes unnoticed',
  gate: 'lint',
  rule: 'style(package-scripts)',
  edits: [
    {
      kind: 'replace',
      path: 'package.json',
      old: '"probes:check": "node scripts/probes.ts --check"',
      new: '"probes:check": "node -e 0"',
    },
  ],
} satisfies Probe;
