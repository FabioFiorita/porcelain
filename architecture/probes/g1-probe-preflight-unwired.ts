import type { Probe } from '../probe.ts';

export default {
  decision: 'G1',
  plants: 'the probe preflight is removed from the fast check',
  gate: 'lint',
  rule: 'style(package-scripts)',
  edits: [
    {
      kind: 'replace',
      path: 'scripts/check.ts',
      old: "  'probes:check',\n",
      new: '',
    },
  ],
} satisfies Probe;
