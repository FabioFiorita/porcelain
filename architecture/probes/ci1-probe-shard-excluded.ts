import type { Probe } from '../probe.ts';

export default {
  decision: 'CI1',
  plants:
    'a matrix exclude that skips the third probe shard, in the workflow and its sanctioned copy alike, while the shard list still reads one to six',
  gate: 'lint',
  rule: 'style(probe-shards)',
  edits: [
    {
      kind: 'replace',
      path: '.github/workflows/probes.yml',
      old: '        shard: [1, 2, 3, 4, 5, 6]\n',
      new: '        shard: [1, 2, 3, 4, 5, 6]\n        exclude:\n          - shard: 3\n',
    },
    {
      kind: 'replace',
      path: 'architecture/sanctioned/ci.json',
      old: '"shard": [1, 2, 3, 4, 5, 6]',
      new: '"shard": [1, 2, 3, 4, 5, 6], "exclude": [{ "shard": 3 }]',
    },
  ],
} satisfies Probe;
