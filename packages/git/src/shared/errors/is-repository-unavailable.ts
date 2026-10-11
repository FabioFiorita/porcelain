import { repositoryUnavailableReason } from './repository-unavailable-reason.ts';

export function isRepositoryUnavailable(error: unknown): boolean {
  return repositoryUnavailableReason(error) !== undefined;
}
