import type { Probe } from '../probe.ts';

export default {
  decision: 'C4',
  plants:
    'git-actions/models/read-interrupted-git-action.ts: ReadInterruptedGitActionResult = GitActionReceiptView | undefined; the service keeps the named return type',
  gate: 'arch',
  rule: 'models-file-shape:',
  edits: [
    {
      kind: 'replace',
      path: 'packages/git-actions/src/models/read-interrupted-git-action.ts',
      old: `export type ReadInterruptedGitActionResult =
  | { kind: 'interrupted'; receipt: GitActionReceiptView }
  | { kind: 'none' };`,
      new: 'export type ReadInterruptedGitActionResult = GitActionReceiptView | undefined;',
    },
    {
      kind: 'replace',
      path: 'packages/git-actions/src/services/read-interrupted-git-action-service.ts',
      old: `    return receipt
      ? { kind: 'interrupted', receipt: gitActionReceiptView(receipt) }
      : { kind: 'none' };`,
      new: '    return receipt && gitActionReceiptView(receipt);',
    },
  ],
} satisfies Probe;
