import type { Probe } from '../probe.ts';

export default {
  decision: 'G1',
  plants:
    'use-cases/access/read-health.ts: an oxlint disable block comment on line 1',
  gate: 'lint',
  rule: 'style(disable-directives)',
  edits: [
    {
      kind: 'prepend',
      path: 'apps/server/src/use-cases/access/read-health.ts',
      content: `${'/*'} oxlint-disable */
`,
    },
  ],
} satisfies Probe;
