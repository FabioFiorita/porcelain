import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import { runGitRead } from '../../shared/run-git.ts';

export function readGitVersion(
  limits: GitLimits,
  signal?: AbortSignal,
): Promise<Buffer> {
  return runGitRead(process.cwd(), ['--version'], limits, signal);
}
