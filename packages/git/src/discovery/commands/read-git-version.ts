import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import { gitRead } from '../../shared/commands/run-git.ts';

export function readGitVersion(limits: GitLimits) {
  return gitRead(process.cwd(), ['--version'], limits);
}
