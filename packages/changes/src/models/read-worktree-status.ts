import type { ChangeStatusObservation } from './change-status.ts';

export type ReadWorktreeStatusInput = { worktreeId: string };

export type ReadWorktreeStatusResult = ChangeStatusObservation;
