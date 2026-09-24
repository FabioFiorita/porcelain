import type { Probe } from '../probe.ts';

export default {
  decision: 'C3',
  plants:
    'ports/announced-edit-store.ts: a store method takes (input, context), the shape only a *UseCasePort may declare',
  gate: 'lint',
  rule: 'porcelain(port-shape)',
  edits: [
    {
      kind: 'append',
      path: 'apps/server/src/ports/announced-edit-store.ts',
      content: `
export interface ContextualEditStore {
  save(input: AnnouncedEdit, context: AnnouncedEdit): void;
}
`,
    },
  ],
} satisfies Probe;
