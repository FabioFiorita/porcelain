import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants: 'a view collects its rows with a for...of loop',
  gate: 'web-lint',
  rule: 'porcelain(web-views-no-loops)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/views/probe-view.tsx',
      content:
        'export function probeLabels(names: string[]) {\n  const labels: string[] = [];\n  for (const name of names) labels.push(name);\n  return labels;\n}\n',
    },
  ],
} satisfies Probe;
