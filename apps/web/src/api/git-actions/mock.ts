import { ConnectionError } from '@porcelain/client/errors/connection-error';
import type { ActionInput, Receipt } from '../../domain/git-action';
import { changePath } from '../../domain/review';
import { createId } from '../../lib/id';
import type { createMockStore } from '../inventory/mock';
import { createReviewMock } from '../review/mock';
import type { GitActionsPort } from './port';
export function createGitActionsMock(
  store: ReturnType<typeof createMockStore>,
): GitActionsPort {
  const requests = new Map<string, string>();
  const receipts = new Map<string, Receipt>();
  return {
    async models() {
      return [{ id: 'codex:gpt-5.6-luna', label: 'Fixture model' }];
    },
    async draft(request) {
      const { input } = request;
      const { changes } = await createReviewMock(store).changes(request);
      return {
        groups: [{ message: 'Review workspace changes', paths: input.paths }],
        expectedFiles: changes.changes.flatMap((file) =>
          input.paths.includes(file.path) && file.fingerprint
            ? [{ path: file.path, fingerprint: file.fingerprint }]
            : [],
        ),
      };
    },
    async branches(request) {
      request.signal.throwIfAborted();
      const data = store.review[request.worktreeId];
      if (!data) throw new ConnectionError('Mock worktree unavailable.');
      const name = data.git.branch?.name ?? null;
      return {
        current: name,
        branches: name
          ? [
              {
                name,
                upstream: data.git.branch?.upstream ?? null,
                lastCommitAt:
                  data.history.commits[0]?.author.timestamp ??
                  new Date(0).toISOString(),
                checkedOutElsewhere: false,
              },
            ]
          : [],
      };
    },
    async run(request) {
      request.signal.throwIfAborted();
      const { requestId, input, expected } = request.input;
      const identity = JSON.stringify([
        request.projectId,
        request.worktreeId,
        input,
        expected,
      ]);
      const existing = receipts.get(requestId);
      if (existing) {
        if (requests.get(requestId) !== identity)
          throw new ConnectionError('Request mismatch.');
        return structuredClone(existing);
      }
      const data = store.review[request.worktreeId];
      if (!data) throw new ConnectionError('Mock worktree unavailable.');
      store.lastAction = structuredClone({ input, expected });
      if (store.actionGate) await store.actionGate;
      const discardedRestore =
        input.action === 'stash-apply' &&
        store.discardedBackups.some((item) => item.oid === input.stashOid);
      const unsupported =
        !discardedRestore &&
        [
          'stash-apply',
          'stash-pop',
          'discard',
          'switch-branch',
          'create-branch',
        ].includes(input.action);
      const stale = expected.headOid !== data.git.headOid;
      const noChange =
        input.action === 'commit' &&
        !data.git.comparisons.some((change) =>
          input.paths.includes(changePath(change)),
        );
      const receipt: Receipt = {
        requestId,
        projectId: request.projectId,
        worktreeId: request.worktreeId,
        action: input.action,
        state: unsupported
          ? 'rejected'
          : (store.nextActionState ?? mockReceiptState(stale, noChange)),
        ...(unsupported
          ? {
              reason: 'UNSUPPORTED_CONFIGURATION' as const,
              message:
                'This action needs a real Git repository; it is not simulated in the mock.',
            }
          : {}),
        progress: [],
        acceptedAt: Date.now(),
        finishedAt: Date.now(),
      };
      if (receipt.state === 'succeeded') {
        applyMockAction(data, input, input.action);
        if (discardedRestore)
          store.discardedBackups = store.discardedBackups.filter(
            (item) => item.oid !== input.stashOid,
          );
        if (data.git.headOid) receipt.result = { headOid: data.git.headOid };
      }
      requests.set(requestId, identity);
      receipts.set(requestId, receipt);
      if (receipt.state === 'succeeded') store.actionCount += 1;
      if (store.loseActionResponse)
        throw new ConnectionError(
          'Mock response lost. Check the receipt to recover the outcome.',
        );
      return structuredClone(receipt);
    },
    async dismissInterrupted(request) {
      request.signal.throwIfAborted();
    },
    async receipt(request) {
      request.signal.throwIfAborted();
      const receipt = receipts.get(request.requestId);
      if (!receipt)
        throw new ConnectionError(
          'Receipt not found. Do not submit a new request while the outcome is unknown.',
        );
      return structuredClone(receipt);
    },
  };
}

function applyMockAction(
  data: ReturnType<typeof createMockStore>['review'][string],
  input: ActionInput,
  action: ActionInput['action'],
) {
  if (action === 'commit' || action === 'amend') {
    const oid = createId().replaceAll('-', '').padEnd(40, '0');
    const message = 'message' in input ? input.message : 'Mock commit';
    const [subject = '', ...bodyLines] = message.split('\n');
    const bodyText = bodyLines.join('\n').trim();
    if (action === 'amend') data.history.commits.shift();
    data.history.commits.unshift({
      oid,
      parentOids: data.git.headOid ? [data.git.headOid] : [],
      author: {
        name: 'Mock developer',
        timestamp: new Date().toISOString(),
      },
      subject,
      subjectTruncated: false,
      body: bodyText || null,
      bodyTruncated: false,
      refs: [],
    });
    data.git.headOid = oid;
    if (data.history.snapshot) data.history.snapshot.tipOid = oid;
    data.git.comparisons = data.git.comparisons.filter((change) =>
      'paths' in input && input.paths
        ? !input.paths.includes(changePath(change))
        : change.scope !== 'staged',
    );
  }
  if (action === 'stash-create')
    data.git.comparisons = data.git.comparisons.filter(
      (change) =>
        change.scope === 'unmerged' ||
        (change.scope === 'untracked' &&
          !('includeUntracked' in input && input.includeUntracked)),
    );
}

function mockReceiptState(stale: boolean, noChange: boolean): Receipt['state'] {
  if (stale) return 'rejected';
  return noChange ? 'no-change' : 'succeeded';
}
