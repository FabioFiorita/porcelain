import {
  browseProjectFolders,
  discoverProjects,
  readInventory,
  registerProject,
  removeProject,
  renameProject,
} from '@porcelain/client/inventory';
import type { InventoryPort } from './port';

export function createInventoryLive(transport: typeof fetch): InventoryPort {
  return {
    remove: (options) =>
      removeProject({ ...options, endpoint: '/api', fetch: transport }),
    rename: (options) =>
      renameProject({ ...options, endpoint: '/api', fetch: transport }),
    discover: (options) =>
      discoverProjects({ ...options, endpoint: '/api', fetch: transport }),
    browse: (options) =>
      browseProjectFolders({ ...options, endpoint: '/api', fetch: transport }),
    read: (options) =>
      readInventory({ ...options, endpoint: '/api', fetch: transport }),
    register: (options) =>
      registerProject({ ...options, endpoint: '/api', fetch: transport }),
  };
}
