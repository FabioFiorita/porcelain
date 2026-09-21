import type {
  GitActionExpectation,
  GitActionIntent,
  GitActionOutcome,
} from '../dtos/git-action.ts';
import type { CheckoutSession } from './git-session.ts';

export interface GitActionWriter {
  readSelectedDiff?(
    headOid: string | null,
    paths: readonly string[],
    signal: AbortSignal,
  ): Promise<string>;
  listBranches?(signal: AbortSignal): Promise<{
    current: string | null;
    branches: {
      name: string;
      upstream: string | null;
      lastCommitAt: string;
      checkedOutElsewhere: boolean;
    }[];
  }>;
  executeDirect(
    requestId: string,
    intent: GitActionIntent,
    expected: GitActionExpectation,
    signal: AbortSignal,
    onProgress?: (line: string) => void,
    verifyTarget?: () => Promise<void>,
  ): Promise<GitActionOutcome>;
}
export type GitActionWriterFactory = (
  session: CheckoutSession,
) => GitActionWriter;
