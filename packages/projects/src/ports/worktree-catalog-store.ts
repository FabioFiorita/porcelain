import { Context } from 'effect';
import { type WorktreeKey } from '@porcelain/kernel/models';
import { type ListedWorktree } from '../models/listed-worktree.ts';
import { type ProjectKey } from '../models/project.ts';
import {
  type CatalogEntry,
  type CatalogObservation,
  type CatalogSnapshot,
} from '../models/worktree-catalog.ts';

export interface WorktreeCatalogStore {
  find(input: WorktreeKey): CatalogEntry | undefined;
  lastSeen(input: ProjectKey): ListedWorktree[];
  listObservations(): CatalogObservation[];
  save(input: CatalogSnapshot): void;
}

export const WorktreeCatalogStore = Context.Service<
  '@porcelain/projects/WorktreeCatalogStore',
  WorktreeCatalogStore
>('@porcelain/projects/WorktreeCatalogStore');
