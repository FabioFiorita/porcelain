import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: "a component opts out of the React Compiler with 'use no memo'",
  gate: 'web-lint',
  rule: 'style(react-compiler)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/views/probe-view.tsx',
      content:
        "export function ProbeView(props: { label: string }) {\n  'use no memo';\n  return <p>{props.label}</p>;\n}\n",
    },
  ],
} satisfies Probe;
