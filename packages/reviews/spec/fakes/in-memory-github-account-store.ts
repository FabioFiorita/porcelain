import { Effect } from 'effect';
import type { GitHubAccountPreference } from '../../src/models/pull-request.ts';
import type { GitHubAccountStore } from '../../src/ports/github-account-store.ts';
export class InMemoryGitHubAccountStore implements GitHubAccountStore {
  readonly preferences = new Map<string, GitHubAccountPreference>();
  read(input: { projectId: string }) {
    return Effect.sync(() => this.preferences.get(input.projectId));
  }
  detect(input: { projectId: string; repository: string; account: string }) {
    return Effect.sync(() => {
      const previous = this.preferences.get(input.projectId);
      this.preferences.set(input.projectId, {
        repository: input.repository,
        detected: input.account,
        override: previous?.override,
      });
    });
  }
  override(input: {
    projectId: string;
    repository: string;
    account: string | undefined;
  }) {
    return Effect.sync(() => {
      this.preferences.set(input.projectId, {
        repository: input.repository,
        detected: undefined,
        override: input.account ?? undefined,
      });
    });
  }
}
