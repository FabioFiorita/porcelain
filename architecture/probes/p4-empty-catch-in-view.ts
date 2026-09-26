import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'a web file swallows a failure in an empty catch',
  gate: 'web-lint',
  rule: 'porcelain(web-no-empty-catch)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/queries/probe-query.ts',
      content:
        'export function probeSwallow(run: () => void) {\n  try {\n    run();\n  } catch {}\n}\n',
    },
  ],
} satisfies Probe;
