import type { Probe } from '../probe.ts';

export default {
  decision: 'CI2',
  plants:
    'the web workflow computes the merge base with the pull request base branch as the repetition base, so every journey the pull request adds runs five times on every push',
  gate: 'lint',
  rule: 'style(ci-steps)',
  edits: [
    {
      kind: 'replace',
      path: '.github/workflows/web.yml',
      old: '      - run: pnpm verify:web --all\n        env:\n          PORCELAIN_REPETITION_BASE: ${{ github.event.before }}\n',
      new: '      - run: PORCELAIN_REPETITION_BASE="$(git merge-base HEAD origin/${{ github.base_ref }})" pnpm verify:web --all\n',
    },
  ],
} satisfies Probe;
