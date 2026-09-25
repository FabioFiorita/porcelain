import type { Probe } from '../probe.ts';

export default {
  decision: 'W1',
  plants: 'the browser behaviour net deleted from the web workflow',
  gate: 'lint',
  rule: 'style(ci-steps)',
  edits: [
    {
      kind: 'replace',
      path: '.github/workflows/web.yml',
      old: '      - run: pnpm verify:web --all\n',
      new: '',
    },
  ],
} satisfies Probe;
