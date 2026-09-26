import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants:
    'the console-error negative journey deleted, so the runner would prove one guard less',
  gate: 'web-verify',
  feature: 'app.shell',
  rule: 'negatives: apps/web/spec/negative holds the 3 negative journeys',
  edits: [
    {
      kind: 'delete',
      path: 'apps/web/spec/negative/console-error.browser.ts',
    },
  ],
} satisfies Probe;
