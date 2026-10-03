import type { Probe } from '../probe.ts';

export default {
  decision: 'P14',
  plants:
    'vitest.config.ts stops requiring assertions in the server project, and a server spec asserts nothing',
  gate: 'lint',
  rule: 'style(vitest-config)',
  edits: [
    {
      kind: 'replace',
      path: 'vitest.config.ts',
      old: 'expect: { requireAssertions: true },',
      new: 'expect: { requireAssertions: false },',
    },
    {
      kind: 'append',
      path: 'apps/server/src/runtime/interval-job.spec.ts',
      content:
        "\ndescribe('IntervalJob probe', () => {\n  it('settles', async () => {\n    await settle(0);\n  });\n});\n",
    },
  ],
} satisfies Probe;
