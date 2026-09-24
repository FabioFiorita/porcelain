import type { RegisteredProject } from './project.ts';
import type { DiscoveredProjectRepository } from './project-repository.ts';

export type RegisterProjectInput = {
  repository: DiscoveredProjectRepository;
  originUrl: string | undefined;
};

export type RegisterProjectResult = RegisteredProject;
