import type { Probe } from '../probe.ts';

export default {
  decision: 'C3',
  plants:
    'new apps/server/src/runtime/probe-handle.ts: a type alias with a close() method, a port in all but name, outside ports/',
  gate: 'lint',
  rule: 'porcelain(no-port-shaped-alias)',
  edits: [
    {
      kind: 'create',
      path: 'apps/server/src/runtime/probe-handle.ts',
      content: `export type ProbeHandle = { close(): Promise<void> };
`,
    },
  ],
} satisfies Probe;
