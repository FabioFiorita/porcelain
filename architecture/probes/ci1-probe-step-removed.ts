import type { Probe } from '../probe.ts';

export default {
  decision: 'CI1',
  plants:
    'the pnpm probes step removed from the probe workflow and its sanctioned copy alike, so no CI job plants the probes',
  gate: 'lint',
  rule: 'style(probe-shards)',
  edits: [
    {
      kind: 'replace',
      path: '.github/workflows/probes.yml',
      old: '      - run: pnpm probes --shard ${{ matrix.shard }}/6\n',
      new: '',
    },
    {
      kind: 'replace',
      path: 'architecture/sanctioned/ci.json',
      old: ',\n            {\n              "run": "pnpm probes --shard ${{ matrix.shard }}/6"\n            }\n',
      new: '\n',
    },
  ],
} satisfies Probe;
