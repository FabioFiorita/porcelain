import type { CheckoutSession } from '../../inspection/index.ts';
import type {
  GitActionExpectation,
  GitActionIntent,
  GitActionOutcome,
} from '../dtos/git-action.ts';

export interface GitActionWriter {
  readSelectedDiff(
    headOid: string | null,
    paths: readonly string[],
    signal?: AbortSignal,
  ): Promise<string>;
  executeDirect(
    requestId: string,
    intent: GitActionIntent,
    expected: GitActionExpectation,
    signal: AbortSignal,
    onProgress?: (line: string) => void,
    verifyTarget?: () => Promise<void>,
  ): Promise<GitActionOutcome>;
}

export interface GitActionWriterFactory {
  (session: CheckoutSession): GitActionWriter;
}
