import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { createIsolatedGit } from '@porcelain/git/fixtures/isolated-git';

export async function createPlayground() {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-playground-'));
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
    await git('init', '--bare', remote);
    await git('init', '-b', 'main', project);
    await git('-C', project, 'config', 'user.name', 'Playground');
    await git(
      '-C',
      project,
      'config',
      'user.email',
      'playground@example.invalid',
    );
    await writeFile(join(project, 'README.md'), '# Example project\n');
    await writeFile(join(project, '.gitignore'), '.cache/\n');
    await git('-C', project, 'add', '.');
    await git('-C', project, 'commit', '-m', 'Create example project');
    await writeFile(
      join(project, 'README.md'),
      '# Example project\n\nReady for review.\n',
    );
    await git('-C', project, 'commit', '-am', 'Explain the example');
    await git('-C', project, 'remote', 'add', 'origin', remote);
    await git('-C', project, 'push', '-u', 'origin', 'main');
    await git('-C', project, 'worktree', 'add', '-b', 'review', worktree);
    await git('-C', worktree, 'push', '-u', 'origin', 'review');
    await writeFile(
      join(worktree, 'README.md'),
      '# Example project\n\nA staged change.\n',
    );
    await git('-C', worktree, 'add', 'README.md');
    await writeFile(
      join(worktree, 'README.md'),
      '# Example project\n\nA staged change.\nAn unstaged addition.\n',
    );
    await writeFile(
      join(worktree, 'notes.txt'),
      'A new file for includeUntracked stash.\n',
    );
    await mkdir(join(worktree, '.cache'));
    await writeFile(
      join(worktree, '.cache/local.txt'),
      'Ignored files stay outside the stash.\n',
    );
    const token = randomBytes(32).toString('base64url');
    const tokenFile = join(root, 'token.txt');
    await writeFile(tokenFile, token, { mode: 0o600 });
    return {
      root,
      project,
      worktree,
      remote,
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
