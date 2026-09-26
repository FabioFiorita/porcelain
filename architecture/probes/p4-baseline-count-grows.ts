import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'a baselined file gains one more useState than the baseline holds',
  gate: 'web-lint',
  rule: 'porcelain(web-no-use-state)',
  edits: [
    {
      kind: 'append',
      path: 'apps/web/src/app/views/connected-workspace.tsx',
      content:
        "\nexport function ProbeGrow() {\n  const [value] = useState('');\n  return value;\n}\n",
    },
  ],
} satisfies Probe;
