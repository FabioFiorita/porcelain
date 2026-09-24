import type {
  CompareKnownWorktreesInput,
  CompareKnownWorktreesResult,
} from '../models/compare-known-worktrees.ts';
import { knownWorktreesChanged } from '../rules/known-worktrees-changed.ts';

export class CompareKnownWorktreesService {
  execute(input: CompareKnownWorktreesInput): CompareKnownWorktreesResult {
    return { changed: knownWorktreesChanged(input.before, input.after) };
  }
}
