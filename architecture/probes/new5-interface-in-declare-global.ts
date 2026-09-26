import type { Probe } from '../probe.ts';

export default {
  decision: 'G1',
  plants:
    'files/services/list-directory-service.ts: a `declare global { interface ListingBudget { ... } }` block (an interface outside ports/, dressed as an augmentation)',
  gate: 'lint',
  rule: 'porcelain(interfaces-only-in-ports)',
  edits: [
    {
      kind: 'append',
      path: 'packages/files/src/services/list-directory-service.ts',
      content: `
declare global {
  interface ListingBudget {
    entries: number;
  }
}
`,
    },
  ],
} satisfies Probe;
