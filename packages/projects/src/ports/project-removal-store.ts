import type { RemoveProjectResult } from '../models/project-operations.ts';

export interface ProjectRemovalStore {
  remove(projectId: string): RemoveProjectResult;
}
