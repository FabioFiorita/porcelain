import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants: 'the feature-map check is removed from the fast check',
  gate: 'lint',
  rule: 'style(package-scripts)',
  edits: [
    {
      kind: 'replace',
      path: 'package.json',
      old: ' probes:check features:check --output-logs=errors-only',
      new: ' probes:check --output-logs=errors-only',
    },
  ],
} satisfies Probe;
