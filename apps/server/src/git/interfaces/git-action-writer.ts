import type {
  GitActionIntent,
  GitActionOutcome,
  GitActionPreparation,
} from '../../models/git-action.ts';
import type { GitActionSnapshot } from '../dtos/git-action-snapshot.ts';

export interface GitActionWriter {
  inspect(
    intent: GitActionIntent,
    signal: AbortSignal,
  ): Promise<GitActionSnapshot>;
  execute(
    preparation: GitActionPreparation,
    snapshot: GitActionSnapshot,
    signal: AbortSignal,
  ): Promise<GitActionOutcome>;
}
export type GitActionWriterFactory = (
  checkout: string,
  identity: string,
  repositoryIdentity: string,
) => GitActionWriter;
