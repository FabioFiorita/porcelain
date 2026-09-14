import type { CommentsPort } from './comments/port';
import type { FilePreferencesPort } from './file-preferences/port';
import type { GitActionsPort } from './git-actions/port';
import type { InventoryPort } from './inventory/port';
import type { ReviewPort } from './review/port';
import type { SessionPort } from './session/port';
export type Api = {
  session: SessionPort;
  comments: CommentsPort;
  filePreferences: FilePreferencesPort;
  inventory: InventoryPort;
  review: ReviewPort;
  gitActions: GitActionsPort;
};
