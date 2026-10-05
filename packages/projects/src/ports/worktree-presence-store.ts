import type { Effect } from 'effect';
import { Context } from 'effect';
import { type ProjectKey } from '../models/project.ts';
import {
  type RemoveWorktreePresenceInput,
  type SaveWorktreePresenceInput,
  type WorktreePresence,
} from '../models/worktree-presence.ts';

export interface WorktreePresenceStore {
  list(): Effect.Effect<WorktreePresence[]>;
  read(input: ProjectKey): Effect.Effect<WorktreePresence[]>;
  save(input: SaveWorktreePresenceInput): Effect.Effect<void>;
  remove(input: RemoveWorktreePresenceInput): Effect.Effect<void>;
}

export const WorktreePresenceStore = Context.Service<
  '@porcelain/projects/WorktreePresenceStore',
  WorktreePresenceStore
>('@porcelain/projects/WorktreePresenceStore');
