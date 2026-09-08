import type {
  GitActionCommand,
  GitActionIntent,
  GitActionOutcome,
} from '../dtos/git-action.ts';
import type { GitActionSnapshot } from '../dtos/git-action-snapshot.ts';

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
  checkout: string,
  identity: string,
  repositoryIdentity: string,
) => GitActionWriter;
