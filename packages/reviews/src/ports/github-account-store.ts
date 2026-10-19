import { Context, type Effect } from 'effect';
import type { GitHubAccountPreference } from '../models/pull-request.ts';
export interface GitHubAccountStore {
  read(input: {
    projectId: string;
  }): Effect.Effect<GitHubAccountPreference | undefined>;
  detect(input: {
    projectId: string;
    repository: string;
    account: string;
  }): Effect.Effect<void>;
  override(input: {
    projectId: string;
    repository: string;
    account: string | undefined;
  }): Effect.Effect<void>;
}
export const GitHubAccountStore = Context.Service<
  '@porcelain/reviews/GitHubAccountStore',
  GitHubAccountStore
>('@porcelain/reviews/GitHubAccountStore');
