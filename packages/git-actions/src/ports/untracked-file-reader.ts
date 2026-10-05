import type { WorktreeRead } from '@porcelain/effects/worktree';
import type { Effect } from 'effect';
import type {
  UntrackedFileRead,
  UntrackedFileRequest,
} from '../models/commit-draft-evidence.ts';

export interface UntrackedFileReader {
  read(
    input: UntrackedFileRequest,
  ): Effect.Effect<UntrackedFileRead, never, WorktreeRead>;
}
