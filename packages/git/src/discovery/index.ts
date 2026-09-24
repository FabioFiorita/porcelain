export { DiscoveryGit } from './discovery-git.ts';
export { readGitVersion } from './commands/read-git-version.ts';
export { identity } from '../shared/identity.ts';
export { corroborates, readGitdirPointer } from '../shared/gitdir.ts';
export { readHead } from './commands/read-head.ts';
export { isRepositoryUnavailable } from './errors/is-repository-unavailable.ts';
export { RepositoryIdentityMismatchError } from './errors/repository-identity-mismatch-error.ts';
export type { DiscoveryResult } from './dtos/discovery-result.ts';
export type { GitFactory } from './interfaces/git-factory.ts';
