import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'a server file entered into the web baseline',
  gate: 'web-lint',
  rule: 'style(web-baseline)',
  edits: [
    {
      kind: 'replace',
      path: 'architecture/web-baseline.json',
      old: '"apps/web/src/features/review/views/inline-composer.tsx": 1',
      new: '"apps/web/src/features/review/views/inline-composer.tsx": 1,\n    "apps/server/src/bootstrap/main.ts": 1',
    },
  ],
} satisfies Probe;
