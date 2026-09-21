import type {
  GitActionExpectation,
  GitActionIntent,
} from '@porcelain/git/dtos/git-action';
import type { GitActionReceipt } from '../../models/git-action.ts';

export interface GitActionStore {
  receipt(id: string): GitActionReceipt | undefined;
  acceptDirect(
    scope: { projectId: string; worktreeId: string },
    requestId: string,
    intent: GitActionIntent,
    expected: GitActionExpectation,
    requestFingerprint: string,
  ): { receipt: GitActionReceipt; created: boolean };
  finish(value: GitActionReceipt): void;
  interrupted(worktreeId: string): GitActionReceipt | undefined;
  dismissInterrupted(
    scope: { projectId: string; worktreeId: string },
    requestId: string,
  ): void;
  running(projectId: string): boolean;
  recover(): void;
}
