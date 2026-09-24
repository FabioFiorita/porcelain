import type { WorktreeKey } from '@porcelain/kernel/models';
import type { ListedWorktree } from '../models/listed-worktree.ts';
import type { ProjectKey } from '../models/project.ts';
import type {
  CatalogEntry,
  CatalogObservation,
  CatalogSnapshot,
} from '../models/worktree-catalog.ts';

export interface WorktreeCatalogStore {
  find(input: WorktreeKey): CatalogEntry | undefined;
  lastSeen(input: ProjectKey): ListedWorktree[];
  observations(): CatalogObservation[];
  save(input: CatalogSnapshot): void;
}
