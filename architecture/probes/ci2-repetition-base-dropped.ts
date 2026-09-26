import type { Probe } from '../probe.ts';

export default {
  decision: 'CI2',
  plants:
    'the web workflow stops passing the previous push as the repetition base, so every journey new to the pull request base runs five times on every push',
  gate: 'lint',
  rule: 'style(ci-steps)',
  edits: [
    {
      kind: 'replace',
      path: '.github/workflows/web.yml',
      old: '        env:\n          PORCELAIN_REPETITION_BASE: ${{ github.event.before }}\n',
      new: '',
    },
  ],
} satisfies Probe;
