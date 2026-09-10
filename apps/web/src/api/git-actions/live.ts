import { createGitActionsClient } from '@porcelain/client/git-actions';
import type { GitActionsPort } from './port';
export function createGitActionsLive(transport: typeof fetch): GitActionsPort {
  return createGitActionsClient(transport, '/api');
}
