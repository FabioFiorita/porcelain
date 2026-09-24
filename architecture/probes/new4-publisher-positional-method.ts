import type { Probe } from '../probe.ts';

export default {
  decision: 'C6',
  plants:
    'apps/server/src/ports/event-publisher.ts: one more positional method added to EventPublisher',
  gate: 'lint',
  rule: 'porcelain(port-shape)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/ports/event-publisher.ts',
      old: '  inventoryChanged(): void;',
      new: `  inventoryChanged(): void;
  reviewChanged?(worktreeId: string, revision: number): void;`,
    },
  ],
} satisfies Probe;
