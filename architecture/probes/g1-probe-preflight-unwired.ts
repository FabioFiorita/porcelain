import type { Probe } from '../probe.ts';

export default {
  decision: 'G1',
  plants: 'the probe preflight is removed from the fast check',
  gate: 'lint',
  rule: 'style(package-scripts)',
  edits: [
    {
      kind: 'replace',
      path: 'package.json',
      old: ' test:rules probes:check --output-logs=errors-only',
      new: ' test:rules --output-logs=errors-only',
    },
  ],
} satisfies Probe;
