import type { Probe } from '../probe.ts';

export default {
  decision: 'CI2',
  plants: 'the automatic fast check removed from CI',
  gate: 'lint',
  rule: 'style(ci-steps)',
  edits: [
    {
      kind: 'replace',
      path: '.github/workflows/server.yml',
      old: '      - run: pnpm check\n',
      new: '',
    },
  ],
} satisfies Probe;
