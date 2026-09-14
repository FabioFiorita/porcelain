import { ConnectionError } from '@porcelain/client/errors/connection-error';
import type { Preparation, Receipt } from '../../domain/git-action';
import { changePath } from '../../domain/review';
import { createId } from '../../lib/id';
import type { createMockStore } from '../inventory/mock';
import type { GitActionsPort } from './port';
export function createGitActionsMock(
  store: ReturnType<typeof createMockStore>,
): GitActionsPort {
  const prepared = new Map<
    string,
    {
      preparation: Preparation;
      worktreeId: string;
      projectId: string;
      input: Parameters<GitActionsPort['prepare']>[0]['input'];
    }
  >();
  const receipts = new Map<string, Receipt>();
  return {
    async models() {
      return [{ id: 'fixture:default', label: 'Fixture model' }];
    },
    async draft({ input }) {
      return {
        groups: [{ message: 'Review workspace changes', paths: input.paths }],
        expectedFiles: [],
      };
    },
    async prepare(request) {
      request.signal.throwIfAborted();
      const data = store.review[request.worktreeId];
      if (!data || !request.token)
        throw new ConnectionError('Mock worktree unavailable.');
      if (request.action === 'stash-apply' || request.action === 'stash-pop')
        throw new ConnectionError(
          'Stash apply and pop are not simulated in this mock. The live adapter supports preparing these actions with a known stash object ID.',
        );
      const preparation: Preparation = {
        preparationId: createId(),
        expiresAt: Date.now() + 300_000,
        action: request.action,
        preview: {
          headOid: data.status.headOid,
          branch:
            data.history.snapshot.head.kind === 'detached'
              ? null
              : data.history.snapshot.head.ref,
          staged: data.status.changes.some(
            (change) => change.scope === 'staged',
          ),
          trackedChanges: data.status.changes.some(
            (change) => change.scope === 'unstaged',
          ),
          untrackedCount: data.status.changes.filter(
            (change) => change.scope === 'untracked',
          ).length,
          ...('remoteName' in request.input
            ? { destination: `Mock ${request.input.remoteName}` }
            : {}),
        },
      };
      prepared.set(preparation.preparationId, {
        preparation,
        worktreeId: request.worktreeId,
        projectId: request.projectId,
        input: request.input,
      });
      return structuredClone(preparation);
    },
    async execute(request) {
      request.signal.throwIfAborted();
      const existing = receipts.get(request.requestId);
      if (existing) {
        if (existing.preparationId !== request.preparationId)
          throw new ConnectionError('Request mismatch.');
        return structuredClone(existing);
      }
      const saved = prepared.get(request.preparationId);
      const data = store.review[request.worktreeId];
      if (
        !saved ||
        !data ||
        saved.worktreeId !== request.worktreeId ||
        saved.projectId !== request.projectId ||
        saved.preparation.action !== request.action
      )
        throw new ConnectionError('Preparation is unavailable.');
      prepared.delete(request.preparationId);
      const stale = saved.preparation.expiresAt < Date.now();
      const noChange =
        request.action === 'commit' &&
        !data.status.changes.some((change) =>
          'paths' in saved.input && saved.input.paths
            ? saved.input.paths.includes(changePath(change))
            : change.scope === 'staged',
        );
      const receipt: Receipt = {
        requestId: request.requestId,
        preparationId: request.preparationId,
        projectId: request.projectId,
        worktreeId: request.worktreeId,
        action: request.action,
        state: mockReceiptState(stale, noChange),
        refreshRequired: !stale && !noChange,
        acceptedAt: Date.now(),
        finishedAt: Date.now(),
      };
      if (receipt.state === 'succeeded')
        applyMockAction(data, saved.input, request.action);
      receipts.set(request.requestId, receipt);
      store.actionCount += 1;
      if (store.loseActionResponse)
        throw new ConnectionError(
          'Mock response lost. Check the receipt to recover the outcome.',
        );
      return structuredClone(receipt);
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
  input: Parameters<GitActionsPort['prepare']>[0]['input'],
  action: Preparation['action'],
) {
  if (action === 'commit') {
    const oid = createId().replaceAll('-', '').padEnd(40, '0');
    const message = 'message' in input ? input.message : 'Mock commit';
    const [subject = '', ...bodyLines] = message.split('\n');
    const bodyText = bodyLines.join('\n').trim();
    data.history.commits.unshift({
      oid,
      parentOids: data.status.headOid ? [data.status.headOid] : [],
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
    data.status.headOid = oid;
    data.history.snapshot.tipOid = oid;
    data.status.changes = data.status.changes.filter((change) =>
      'paths' in input && input.paths
        ? !input.paths.includes(changePath(change))
        : change.scope !== 'staged',
    );
  }
  if (action === 'stash-create')
    data.status.changes = data.status.changes.filter(
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
