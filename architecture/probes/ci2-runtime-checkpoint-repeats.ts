import type { Probe } from '../probe.ts';

export default {
  decision: 'CI2',
  plants: 'the runtime checkpoint silently repeats every journey five times',
  gate: 'lint',
  rule: 'style(ci-steps)',
  edits: [
    {
      kind: 'replace',
      path: '.github/workflows/web.yml',
      old: '      - run: pnpm verify:web --all\n',
      new: '      - run: pnpm verify:web --all --repeat 5\n',
    },
  ],
} satisfies Probe;
