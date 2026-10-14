import type { GitConnection } from '../../git-actions/ports/git-connection.ts';
import type { LiveUpdatePort } from './live-update.ts';

export type LiveConnection = GitConnection & {
  readonly onStatusChange?: () => void;
  readonly liveUpdates: LiveUpdatePort;
};
