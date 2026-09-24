import type { Probe } from '../probe.ts';

export default {
  decision: 'C3',
  plants:
    'ports/edit-announcement-writer.ts: a writer method takes (input, context), the shape only a *UseCasePort may declare',
  gate: 'lint',
  rule: 'porcelain(port-shape)',
  edits: [
    {
      kind: 'append',
      path: 'apps/server/src/ports/edit-announcement-writer.ts',
      content: `
export interface ContextualEditWriter {
  announce(input: EditAnnouncement, context: EditAnnouncement): void;
}
`,
    },
  ],
} satisfies Probe;
