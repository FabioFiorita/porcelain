import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants:
    'the integration Vitest config retries a failed test twice, so a flaky test could pass',
  gate: 'web-lint',
  rule: 'style(vitest-config)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/web/vitest.config.ts',
      old: '      retry: 0,\n',
      new: '      retry: 2,\n',
    },
  ],
} satisfies Probe;
