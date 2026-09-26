import type { Probe } from '../probe.ts';

export default {
  decision: 'C7',
  plants:
    'new apps/server/src/ports/notice-port.ts: interface NoticePort with send(worktreeId, kind, revision) positional',
  gate: 'lint',
  rule: 'porcelain(port-shape)',
  edits: [
    {
      kind: 'create',
      path: 'apps/server/src/ports/notice-port.ts',
      content: `export interface NoticePort {
  send(worktreeId: string, kind: string, revision: number): void;
}
`,
    },
  ],
} satisfies Probe;
