import type {
  GitActionPreparation,
  GitActionReceipt,
} from '../../models/git-action.ts';

export function toGitActionPreparation(value: GitActionPreparation) {
  return {
    preparationId: value.id,
    expiresAt: value.expiresAt,
    action: value.intent.action,
    preview: value.preview,
  };
}
export function gitActionStatus(value: GitActionReceipt) {
  if (value.state === 'running') return 202;
  if (value.state === 'indeterminate') return 503;
  if (value.state === 'rejected' || value.state === 'conflicted') return 409;
  return 200;
}
