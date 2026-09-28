import type { Probe } from '../probe.ts';

export default {
  decision: 'P15',
  plants:
    'fast checks and the manual probe audit deleted from the workflows and hook',
  gate: 'lint',
  rule: 'style(ci-steps)',
  edits: [
    {
      kind: 'replace',
      path: '.github/workflows/server.yml',
      old: '      - run: pnpm check\n',
      new: '',
    },
    {
      kind: 'replace',
      path: '.github/workflows/probes.yml',
      old: '      - run: pnpm probes --shard ${{ matrix.shard }}/6\n',
      new: '',
    },
    {
      kind: 'replace',
      path: 'lefthook.yml',
      old: '    - run: pnpm check\n',
      new: '',
    },
  ],
} satisfies Probe;
