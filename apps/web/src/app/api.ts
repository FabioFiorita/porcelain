import type { CommentsPort } from '@/features/reviews/api';
import type { GitActionsPort } from '@/features/git-actions/api';
import type { LiveUpdatePort } from '@/shared/live/port';
import type { PairingPort } from '@/features/access/api';
import type { ReviewPort } from '@/features/review/index';
import type { SessionPort } from '@/features/access/api';
export type Api = {
  session: SessionPort;
  comments: CommentsPort;
  liveUpdates: LiveUpdatePort;
  pairing: PairingPort;
  review: ReviewPort;
  gitActions: GitActionsPort;
};
