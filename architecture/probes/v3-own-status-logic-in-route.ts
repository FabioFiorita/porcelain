import type { Probe } from '../probe.ts';

export default {
  decision: 'V3',
  plants:
    "http/routes/git-actions/run-git-action.ts: status decided by a function declared in the route file (receipt.state === 'rejected' ? 409 : 200)",
  gate: 'lint',
  rule: 'porcelain(feature-route-handler)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/http/routes/git-actions/run-git-action.ts',
      old: `import { gitActionReceiptStatus } from '../../status-policy.ts';
`,
      new: '',
    },
    {
      kind: 'replace',
      path: 'apps/server/src/http/routes/git-actions/run-git-action.ts',
      old: 'reply.code(gitActionReceiptStatus(receipt))',
      new: 'reply.code(statusOf(receipt))',
    },
    {
      kind: 'append',
      path: 'apps/server/src/http/routes/git-actions/run-git-action.ts',
      content: `
function statusOf(receipt: { state: string }): number {
  return receipt.state === 'rejected' ? 409 : 200;
}
`,
    },
  ],
} satisfies Probe;
