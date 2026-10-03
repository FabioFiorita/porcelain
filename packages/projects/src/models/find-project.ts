import type { ProjectKey, RegisteredProject } from './project.ts';

export type FindProjectInput = ProjectKey;

export type FindProjectResult =
  | { kind: 'found'; project: RegisteredProject }
  | { kind: 'missing' };

export type CheckProjectResult = RegisteredProject;

export type ForgetProjectRecordsInput = ProjectKey;
