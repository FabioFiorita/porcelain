import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'the architecture check dropped from the web workflow',
  gate: 'web-lint',
  rule: 'style(ci-steps)',
  edits: [
    {
      kind: 'replace',
      path: '.github/workflows/web.yml',
      old: '      - run: pnpm arch:check\n',
      new: '',
    },
  ],
} satisfies Probe;
