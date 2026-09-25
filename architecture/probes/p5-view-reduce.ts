import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants: 'a view totals its rows with reduce',
  gate: 'web-lint',
  rule: 'porcelain(web-views-no-loops)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/views/probe-view.tsx',
      content:
        'export function probeTotal(sizes: number[]) {\n  return sizes.reduce((total, size) => total + size, 0);\n}\n',
    },
  ],
} satisfies Probe;
