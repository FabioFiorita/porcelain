import type { Probe } from '../probe.ts';

export default {
  decision: 'P7',
  plants: 'a view attaches a variable ref to its DOM element',
  gate: 'web-lint',
  rule: 'porcelain(web-views-no-jsx-refs)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/views/probe-history-ref.tsx',
      content:
        'export function ProbeHistoryRef({ elementRef }: { elementRef: (element: HTMLDivElement | null) => void }) {\n  return <div ref={elementRef} />;\n}\n',
    },
  ],
} satisfies Probe;
