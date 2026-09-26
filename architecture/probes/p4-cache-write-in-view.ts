import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'a view writes the Query cache with setQueryData',
  gate: 'web-lint',
  rule: 'porcelain(web-cache-writes-in-commands)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/views/probe-view.tsx',
      content:
        "export function probeReset(client: {\n  setQueryData: (key: string[], value: undefined) => void;\n}) {\n  client.setQueryData(['access'], undefined);\n}\n",
    },
  ],
} satisfies Probe;
