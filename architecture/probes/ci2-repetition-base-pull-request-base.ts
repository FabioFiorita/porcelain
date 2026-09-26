import type { Probe } from '../probe.ts';

export default {
  decision: 'CI2',
  plants:
    'the web workflow passes the pull request base commit as the repetition base, so every journey the pull request adds runs five times on every push',
  gate: 'lint',
  rule: 'style(ci-steps)',
  edits: [
    {
      kind: 'replace',
      path: '.github/workflows/web.yml',
      old: 'PORCELAIN_REPETITION_BASE: ${{ github.event.before }}',
      new: 'PORCELAIN_REPETITION_BASE: ${{ github.event.pull_request.base.sha }}',
    },
  ],
} satisfies Probe;
