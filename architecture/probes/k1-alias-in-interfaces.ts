import type { Probe } from '../probe.ts';

export default {
  decision: 'K1',
  plants:
    'git inspection/interfaces/status-reader.ts declares a type alias beside its interface',
  gate: 'lint',
  rule: 'porcelain(interfaces-hold-interfaces)',
  edits: [
    {
      kind: 'append',
      path: 'packages/git/src/inspection/interfaces/status-reader.ts',
      content: `
export type StatusSummary = { changed: number };
`,
    },
  ],
} satisfies Probe;
