import type { RegisteredProject } from '../../models/project.ts';

export interface InventoryStore {
  /** Environment and projects. Never Git: health and pairing call this. */
  read(): { environmentId: string; projects: RegisteredProject[] };
  save(project: RegisteredProject): void;
}
