import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'a view wraps work in try/finally',
  gate: 'web-lint',
  rule: 'porcelain(web-views-no-try)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/views/probe-view.tsx',
      content:
        'export function probeGuard(run: () => void, done: () => void) {\n  try {\n    run();\n  } finally {\n    done();\n  }\n}\n',
    },
  ],
} satisfies Probe;
