import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'the fast checks dropped from the runtime checkpoint',
  gate: 'web-lint',
  rule: 'style(ci-steps)',
  edits: [
    {
      kind: 'replace',
      path: '.github/workflows/web.yml',
      old: '      - run: pnpm check\n',
      new: '',
    },
  ],
} satisfies Probe;
