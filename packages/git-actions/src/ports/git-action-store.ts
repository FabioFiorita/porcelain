import type {
  GitActionExpectation,
  GitActionIntent,
  GitActionReceipt,
  GitActionScope,
} from '../models/git-action.ts';

export interface GitActionStore {
  receipt(id: string): GitActionReceipt | undefined;
  acceptDirect(
    scope: GitActionScope,
    requestId: string,
    intent: GitActionIntent,
    expected: GitActionExpectation,
    requestFingerprint: string,
  ): { receipt: GitActionReceipt; created: boolean };
  finish(value: GitActionReceipt): void;
  interrupted(worktreeId: string): GitActionReceipt | undefined;
  dismissInterrupted(scope: GitActionScope, requestId: string): void;
  running(projectId: string): boolean;
  recover(): void;
}
