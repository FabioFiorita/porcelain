import type { Probe } from '../probe.ts';

export default {
  decision: 'P7',
  plants: 'a view attaches an inline callback ref to its DOM element',
  gate: 'web-lint',
  rule: 'porcelain(web-views-no-jsx-refs)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/views/probe-history-ref.tsx',
      content:
        'export function ProbeHistoryRef() {\n  return <div ref={(element) => { if (element) element.id = "probe"; }} />;\n}\n',
    },
  ],
} satisfies Probe;
