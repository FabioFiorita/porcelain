import type { CommentsPort } from './comments/port';
import type { GitActionsPort } from './git-actions/port';
import type { InventoryPort } from './inventory/port';
import type { ReviewPort } from './review/port';
import type { SessionPort } from './session/port';
export type Api = {
  session: SessionPort;
  comments: CommentsPort;
  inventory: InventoryPort;
  review: ReviewPort;
  gitActions: GitActionsPort;
};
