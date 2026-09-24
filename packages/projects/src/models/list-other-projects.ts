import type { RegisteredProject } from './project.ts';

export type ListOtherProjectsInput = { repositoryIdentity: string };

export type ListOtherProjectsResult = { projects: RegisteredProject[] };
