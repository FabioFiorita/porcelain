import { Context } from 'effect';
import type { ExpireGitActionReceiptsOptions as ExpireGitActionReceiptsOptionsShape } from '../models/expire-git-action-receipts.ts';
export const ExpireGitActionReceiptsOptions = Context.Service<
  '@porcelain/git-actions/ExpireGitActionReceiptsOptions',
  ExpireGitActionReceiptsOptionsShape
>('@porcelain/git-actions/ExpireGitActionReceiptsOptions');
