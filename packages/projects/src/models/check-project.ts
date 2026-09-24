import type { RegisteredProject } from './project.ts';

export type CheckProjectInput = { projectId: string };

export type CheckProjectResult = RegisteredProject;
