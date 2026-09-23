export { Git } from './git.ts';
export { readGitVersion } from './read-git-version.ts';
export {
  corroborates,
  identity,
  readGitdirPointer,
  readHead,
} from './worktree-registry.ts';
export { isRepositoryUnavailable } from './errors/is-repository-unavailable.ts';
export { RepositoryIdentityMismatchError } from './errors/repository-identity-mismatch-error.ts';
export type { DiscoveryIssue } from './dtos/discovery-issue.ts';
export type { DiscoveryResult } from './dtos/discovery-result.ts';
export type { GitFactory } from './interfaces/git-factory.ts';
