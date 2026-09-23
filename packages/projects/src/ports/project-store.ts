import type { RegisteredProject } from '../models/project.ts';

export interface ProjectStore {
  read(): { projects: RegisteredProject[] };
  save(project: RegisteredProject): void;
}
