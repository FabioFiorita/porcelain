import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'a view grows past its line budget',
  gate: 'web-lint',
  rule: 'porcelain(web-view-line-budget)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/views/probe-view.tsx',
      content:
        "export const PROBE_ROWS = [\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n  'row',\n];\n",
    },
  ],
} satisfies Probe;
