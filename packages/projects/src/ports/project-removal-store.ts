import type {
  RemoveProjectInput,
  RemoveProjectResult,
} from '../models/remove-project.ts';

export interface ProjectRemovalStore {
  remove(input: RemoveProjectInput): RemoveProjectResult;
}
