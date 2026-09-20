import type {
  GitActionCommand,
  GitActionIntent,
  GitActionOutcome,
} from '../dtos/git-action.ts';
import type { GitActionSnapshot } from '../dtos/git-action-snapshot.ts';
import type { CheckoutSession } from './git-session.ts';

export interface GitActionWriter {
  inspect(
    intent: GitActionIntent,
    signal: AbortSignal,
  ): Promise<GitActionSnapshot>;
  execute(
    preparation: GitActionCommand,
    snapshot: GitActionSnapshot,
    signal: AbortSignal,
  ): Promise<GitActionOutcome>;
}
export type GitActionWriterFactory = (
  session: CheckoutSession,
) => GitActionWriter;
