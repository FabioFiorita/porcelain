import type { Probe } from '../probe.ts';

export default {
  decision: 'C4',
  plants:
    'git-actions/services/read-interrupted-git-action-service.ts: execute returns GitActionReceiptView | undefined',
  gate: 'lint',
  rule: 'porcelain(no-undefined-union-result)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/git-actions/src/services/read-interrupted-git-action-service.ts',
      old: `  ): ReadInterruptedGitActionResult {
    const receipt = this.gitActionReceipts.latestInterrupted({
      worktreeId: input.worktreeId,
    });
    return receipt
      ? { kind: 'interrupted', receipt: gitActionReceiptView(receipt) }
      : { kind: 'none' };`,
      new: `  ): GitActionReceiptView | undefined {
    const receipt = this.gitActionReceipts.latestInterrupted({
      worktreeId: input.worktreeId,
    });
    return receipt && gitActionReceiptView(receipt);`,
    },
    {
      kind: 'replace',
      path: 'packages/git-actions/src/services/read-interrupted-git-action-service.ts',
      old: "import { gitActionReceiptView } from '../rules/git-action-receipt-view.ts';",
      new: `import type { GitActionReceiptView } from '../models/git-action-receipt-view.ts';
import { gitActionReceiptView } from '../rules/git-action-receipt-view.ts';`,
    },
  ],
} satisfies Probe;
