import type { Probe } from '../probe.ts';

export default {
  decision: 'K1',
  plants:
    'new packages/git/src/shared/dtos/probe-handle.ts: a type alias with a method outside interfaces/',
  gate: 'lint',
  rule: 'porcelain(no-port-shaped-alias)',
  edits: [
    {
      kind: 'create',
      path: 'packages/git/src/shared/dtos/probe-handle.ts',
      content: `export type ProbeHandle = { close(): Promise<void> };
`,
    },
  ],
} satisfies Probe;
