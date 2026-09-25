import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants:
    'the production build runs the React Compiler with panicThreshold all_errors, so one component it cannot compile breaks the build',
  gate: 'web-lint',
  rule: 'style(vite-config)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/web/vite.config.ts',
      old: "panicThreshold: 'none'",
      new: "panicThreshold: 'all_errors'",
    },
  ],
} satisfies Probe;
