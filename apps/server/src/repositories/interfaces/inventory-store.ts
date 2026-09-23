import type { RegisteredProject } from '../../models/project.ts';

export interface InventoryStore {
  read(): { environmentId: string; projects: RegisteredProject[] };
  save(project: RegisteredProject): void;
}
