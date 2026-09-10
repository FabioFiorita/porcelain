import type { GitActionsPort } from './git-actions/port';
import type { InventoryPort } from './inventory/port';

import type { ReviewPort } from './review/port';
export type Api = {
  inventory: InventoryPort;
  review: ReviewPort;
  gitActions: GitActionsPort;
};
