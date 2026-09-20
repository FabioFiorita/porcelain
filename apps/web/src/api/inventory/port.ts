import type {
  Inventory,
  Project,
  ProjectDiscovery,
  ProjectFolder,
} from '../../domain/inventory';

export type InventoryPort = {
  remove(options: {
    signal: AbortSignal;
    projectId: string;
  }): Promise<{ deleted: boolean }>;
  discover(options: { signal: AbortSignal }): Promise<ProjectDiscovery>;
  browse(options: {
    signal: AbortSignal;
    path?: string;
  }): Promise<ProjectFolder>;
  read(options: { signal: AbortSignal }): Promise<Inventory>;
  register(options: { signal: AbortSignal; path: string }): Promise<Project>;
  rename(options: {
    signal: AbortSignal;
    projectId: string;
    name: string;
  }): Promise<{ id: string; name: string }>;
};
