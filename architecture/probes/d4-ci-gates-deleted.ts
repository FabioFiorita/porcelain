import type { Probe } from '../probe.ts';

export default {
  decision: 'P15',
  plants:
    'pnpm arch:check and pnpm probes deleted from the workflow, and pnpm arch:check from the pre-push hook',
  gate: 'lint',
  rule: 'style(ci-steps)',
  edits: [
    {
      kind: 'replace',
      path: '.github/workflows/server.yml',
      old: '      - run: pnpm arch:check\n      - run: pnpm probes\n',
      new: '',
    },
    {
      kind: 'replace',
      path: 'lefthook.yml',
      old: '          - run: pnpm arch:check\n',
      new: '',
    },
  ],
} satisfies Probe;
