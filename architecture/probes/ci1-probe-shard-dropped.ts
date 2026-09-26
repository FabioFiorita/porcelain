import type { Probe } from '../probe.ts';

export default {
  decision: 'CI1',
  plants:
    'the last shard dropped from the probe matrix in the workflow and its sanctioned copy alike, so a sixth of the probes never runs',
  gate: 'lint',
  rule: 'style(probe-shards)',
  edits: [
    {
      kind: 'replace',
      path: '.github/workflows/probes.yml',
      old: '        shard: [1, 2, 3, 4, 5, 6]\n',
      new: '        shard: [1, 2, 3, 4, 5]\n',
    },
    {
      kind: 'replace',
      path: 'architecture/sanctioned/ci.json',
      old: '"shard": [1, 2, 3, 4, 5, 6]',
      new: '"shard": [1, 2, 3, 4, 5]',
    },
  ],
} satisfies Probe;
