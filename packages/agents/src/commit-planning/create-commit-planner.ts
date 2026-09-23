import { ClaudeProvider } from '../providers/claude.ts';
import { CodexProvider } from '../providers/codex.ts';
import { CommitPlanner } from './commit-planner.ts';

export function createCommitPlanner(): CommitPlanner {
  return new CommitPlanner([new CodexProvider(), new ClaudeProvider()]);
}
