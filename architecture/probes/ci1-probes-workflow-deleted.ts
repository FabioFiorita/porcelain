import type { Probe } from '../probe.ts';

export default {
  decision: 'CI1',
  plants: 'the probe workflow deleted, so CI plants no probe',
  gate: 'lint',
  rule: 'style(ci-steps)',
  edits: [{ kind: 'delete', path: '.github/workflows/probes.yml' }],
} satisfies Probe;
