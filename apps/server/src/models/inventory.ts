import type { Project } from './project.ts';

export interface Inventory {
  environmentId: string;
  projects: Project[];
}
