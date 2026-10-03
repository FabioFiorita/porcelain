import type { Probe } from '../probe.ts';

export default {
  decision: 'CI1',
  plants:
    'the last shard dropped from the probe matrix, so a sixth of the probes never runs',
  gate: 'lint',
  rule: 'style(manual-audits)',
  edits: [
    {
      kind: 'replace',
      path: '.github/workflows/probes.yml',
      old: '        shard: [1, 2, 3, 4, 5, 6]\n',
      new: '        shard: [1, 2, 3, 4, 5]\n',
    },
  ],
} satisfies Probe;
