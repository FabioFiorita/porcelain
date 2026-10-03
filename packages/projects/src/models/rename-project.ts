import type { ProjectName } from './project.ts';

export type RenameProjectInput = { projectId: string; name: string };

export type RenameProjectResult = { project: ProjectName; changed: boolean };
