import type { CommentsPort } from '@/features/review/index';
import type { FilePreferencesPort } from '@/features/projects/index';
import type { GitActionsPort } from '@/features/review/index';
import type { InventoryPort } from '@/features/projects/index';
import type { LiveUpdatePort } from '@/shared/live/port';
import type { PairingPort } from '@/features/access/index';
import type { ReviewPort } from '@/features/review/index';
import type { SessionPort } from '@/features/access/index';
export type Api = {
  session: SessionPort;
  comments: CommentsPort;
  filePreferences: FilePreferencesPort;
  inventory: InventoryPort;
  liveUpdates: LiveUpdatePort;
  pairing: PairingPort;
  review: ReviewPort;
  gitActions: GitActionsPort;
};
