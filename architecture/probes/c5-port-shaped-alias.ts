import type { Probe } from '../probe.ts';

export default {
  decision: 'STYLE',
  plants: 'a method-bearing alias appears outside the contract folders',
  gate: 'lint',
  rule: 'porcelain(no-port-shaped-alias)',
  edits: [
    {
      kind: 'create',
      path: 'apps/server/src/runtime/probe-handle.ts',
      content: 'export type ProbeHandle = { close(): Promise<void> };\n',
    },
  ],
} satisfies Probe;
