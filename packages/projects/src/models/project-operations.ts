import type { DiscoveredProjectRepository } from './project-repository.ts';

export type CheckProjectInput = { projectId: string };

export type RenameProjectInput = { projectId: string; name: string };

export type RemoveProjectInput = { projectId: string };

export type RemoveProjectResult = { deleted: boolean };

export type ForgetProjectWorktreesInput = { projectId: string };

export type InspectProjectRepositoryInput = { path: string };

export type ReadRepositoryOriginInput = { path: string };

export type ListOtherProjectsInput = { repositoryIdentity: string };

export type RegisterProjectInput = {
  repository: DiscoveredProjectRepository;
  originUrl: string | undefined;
};
