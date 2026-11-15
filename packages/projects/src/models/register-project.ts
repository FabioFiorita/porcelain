import type { RegisteredProject } from './project.ts';
import type { ProjectRepository } from './project-repository.ts';

export type RegisterProjectInput = {
  repository: ProjectRepository;
  reconnectProjectId?: string;
  originUrl: string | undefined;
};

export type RegisterProjectResult = {
  project: RegisteredProject;
  changed: boolean;
};
