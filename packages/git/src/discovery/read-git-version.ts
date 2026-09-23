import { runGitRead } from '../shared/run-git.ts';

let pending: Promise<Buffer> | undefined;

export function readGitVersion(): Promise<Buffer> {
  pending ??= runGitRead(process.cwd(), ['--version']).catch(
    (cause: unknown) => {
      pending = undefined;
      throw cause;
    },
  );
  return pending;
}
