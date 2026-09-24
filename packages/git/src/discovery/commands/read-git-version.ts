import { runGitRead } from '../../shared/run-git.ts';

export function readGitVersion(signal?: AbortSignal): Promise<Buffer> {
  return runGitRead(process.cwd(), ['--version'], signal);
}
