import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { createIsolatedGit } from '@porcelain/git/fixtures/isolated-git';
import { seedPlaygroundProject } from './helpers/seed-playground-project.ts';

export async function createPlayground(parentDirectory = tmpdir()) {
  await mkdir(parentDirectory, { recursive: true });
  const root = await mkdtemp(join(parentDirectory, 'porcelain-playground-'));
  try {
    const bin = await createIsolatedGit(root);
    const environment = {
      ...Object.fromEntries(
        Object.entries(process.env).filter(
          ([key]) => !/^(GIT_|SSH_)/.test(key),
        ),
      ),
      HOME: root,
      XDG_CONFIG_HOME: root,
      PATH: `${bin}:${process.env.PATH}`,
    };
    const project = join(root, 'project');
    const worktree = join(root, 'review');
    const remote = join(root, 'origin.git');
    const execute = promisify(execFile);
    const git = async (...args: string[]) =>
      execute('git', args, { env: environment });
    await seedPlaygroundProject(project, worktree, remote, git);
    const token = randomBytes(32).toString('base64url');
    const tokenFile = join(root, 'token.txt');
    await writeFile(tokenFile, token, { mode: 0o600 });
    return {
      root,
      project,
      worktree,
      remote,
      reviewCommitOid: (
        await git('-C', worktree, 'rev-parse', 'HEAD')
      ).stdout.trim(),
      token,
      tokenFile,
      environment,
      dataDirectory: join(root, 'state'),
    };
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}
