import type { CheckoutSession } from '../../inspection/index.ts';
import type { GitBranchList } from '../dtos/git-branch-list.ts';
import type {
  GitActionExpectation,
  GitActionIntent,
  GitActionOutcome,
} from '../dtos/git-action.ts';

export type GitActionWriter = {
  readSelectedDiff(
    headOid: string | null,
    paths: readonly string[],
    signal: AbortSignal,
  ): Promise<string>;
  listBranches(signal: AbortSignal): Promise<GitBranchList>;
  executeDirect(
    requestId: string,
    intent: GitActionIntent,
    expected: GitActionExpectation,
    signal: AbortSignal,
    onProgress?: (line: string) => void,
    verifyTarget?: () => Promise<void>,
  ): Promise<GitActionOutcome>;
};

export type GitActionWriterFactory = (
  session: CheckoutSession,
) => GitActionWriter;
