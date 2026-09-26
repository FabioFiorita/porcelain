import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants:
    'the browser Vitest config retries a failed journey twice, so a flaky journey could pass',
  gate: 'web-lint',
  rule: 'style(vitest-config)',
  edits: [
    {
      kind: 'replace',
      path: '.agents/skills/web-verify/scripts/vitest.browser.config.ts',
      old: '    retry: 0,\n',
      new: '    retry: 2,\n',
    },
  ],
} satisfies Probe;
