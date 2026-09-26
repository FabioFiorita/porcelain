import type { Probe } from '../probe.ts';

export default {
  decision: 'CI1',
  plants:
    'the Playwright Chromium install dropped from the probe shards, so a shard cannot run a web-verify probe',
  gate: 'lint',
  rule: 'style(ci-steps)',
  edits: [
    {
      kind: 'replace',
      path: '.github/workflows/probes.yml',
      old: '      - run: pnpm exec playwright install --with-deps --only-shell chromium\n',
      new: '',
    },
  ],
} satisfies Probe;
