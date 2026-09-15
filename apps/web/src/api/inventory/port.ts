import type {
  Inventory,
  Project,
  ProjectDiscovery,
  ProjectFolder,
} from '../../domain/inventory';

export type InventoryPort = {
  discover(options: {
    token: string;
    signal: AbortSignal;
  }): Promise<ProjectDiscovery>;
  browse(options: {
    token: string;
    signal: AbortSignal;
    path?: string;
  }): Promise<ProjectFolder>;
  read(options: {
    token: string;
    signal: AbortSignal;
    refresh?: boolean;
  }): Promise<Inventory>;
  register(options: {
    token: string;
    signal: AbortSignal;
    path: string;
  }): Promise<Project>;
};
