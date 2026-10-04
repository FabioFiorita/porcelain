import type { Probe } from '../probe.ts';

export default {
  decision: 'STYLE',
  plants: 'an interfaces folder declares a data alias instead of an interface',
  gate: 'lint',
  rule: 'porcelain(interfaces-hold-interfaces)',
  edits: [
    {
      kind: 'create',
      path: 'packages/git/src/inspection/interfaces/probe-summary.ts',
      content: 'export type ProbeSummary = { changed: number };\n',
    },
  ],
} satisfies Probe;
