export interface Worktree {
  id: string;
  path: string;
  metadataIdentity: string;
  main: boolean;
  branch: string | null;
  available: boolean;
}

export interface Project {
  id: string;
  name: string;
  commonDirectory: string;
  repositoryIdentity: string;
  available: boolean;
  worktrees: Worktree[];
}

export interface Inventory {
  environmentId: string;
  projects: Project[];
}

export interface DiscoveredRepository {
  commonDirectory: string;
  repositoryIdentity: string;
  worktrees: Omit<Worktree, 'id'>[];
}

export interface GitInventory {
  discover(checkout: string): Promise<DiscoveredRepository>;
}

export interface InventoryRepository {
  read(): Inventory;
  save(project: Project): void;
}
