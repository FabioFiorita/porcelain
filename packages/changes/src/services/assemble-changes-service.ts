import type {
  ChangeComparison,
  FileChange,
  WorktreeSide,
} from '../models/change.ts';
import { assembleChanges } from '../models/assemble-changes.ts';

export class AssembleChangesService {
  execute(
    observations: readonly ChangeComparison[],
    sides: ReadonlyMap<string, WorktreeSide>,
  ): FileChange[] {
    return assembleChanges(observations, sides);
  }
}
