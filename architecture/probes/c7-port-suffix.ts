import type { Probe } from '../probe.ts';

export default {
  decision: 'C7',
  plants: 'new reviews/ports/summary-port.ts: export interface SummaryPort',
  gate: 'lint',
  rule: 'porcelain(port-shape)',
  edits: [
    {
      kind: 'create',
      path: 'packages/reviews/src/ports/summary-port.ts',
      content: `export interface SummaryPort {
  read(input: { token: string }): string | undefined;
}
`,
    },
  ],
} satisfies Probe;
