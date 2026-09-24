import type { GitActionScope } from './git-action-scope.ts';

export type DismissInterruptedGitActionInput = GitActionScope & {
  requestId: string;
};
