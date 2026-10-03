import type { ProjectKey } from '../models/project.ts';
import type {
  RemoveWorktreePresenceInput,
  SaveWorktreePresenceInput,
  WorktreePresence,
} from '../models/worktree-presence.ts';

export interface WorktreePresenceStore {
  list(): WorktreePresence[];
  read(input: ProjectKey): WorktreePresence[];
  save(input: SaveWorktreePresenceInput): void;
  remove(input: RemoveWorktreePresenceInput): void;
}
