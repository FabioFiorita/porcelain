import type { Probe } from '../probe.ts';

export default {
  decision: 'CI1',
  plants:
    'the probe shard timeout removed, so a hung shard runs for the six-hour default',
  gate: 'lint',
  rule: 'style(ci-steps)',
  edits: [
    {
      kind: 'replace',
      path: '.github/workflows/probes.yml',
      old: '    timeout-minutes: 20\n',
      new: '',
    },
  ],
} satisfies Probe;
