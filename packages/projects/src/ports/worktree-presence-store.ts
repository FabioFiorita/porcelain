import { Context } from 'effect';
import { type ProjectKey } from '../models/project.ts';
import {
  type RemoveWorktreePresenceInput,
  type SaveWorktreePresenceInput,
  type WorktreePresence,
} from '../models/worktree-presence.ts';

export interface WorktreePresenceStore {
  list(): WorktreePresence[];
  read(input: ProjectKey): WorktreePresence[];
  save(input: SaveWorktreePresenceInput): void;
  remove(input: RemoveWorktreePresenceInput): void;
}

export const WorktreePresenceStore = Context.Service<
  '@porcelain/projects/WorktreePresenceStore',
  WorktreePresenceStore
>('@porcelain/projects/WorktreePresenceStore');
