import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { createServer as createHttpsServer } from 'node:https';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionGit } from './action-git.ts';
import type { GitActionCommand, GitActionIntent } from './dtos/git-action.ts';
import { createIsolatedGit } from './fixtures/isolated-git.ts';
import { Git } from './git.ts';
import { RequestGitSession } from './git-session.ts';

const sshd = '/usr/sbin/sshd';
// Debian's sshd refuses to start without its privilege separation directory,
// which exists once the system service has been set up.
const sshdAvailable =
  existsSync(sshd) && (process.platform !== 'linux' || existsSync('/run/sshd'));

describe('ActionGit', () => {
  const execute = promisify(execFile);
  let root: string;
  let checkout: string;
  let adapter: ActionGit;
  const signal = () => AbortSignal.timeout(15_000);
  async function git(...args: string[]) {
    const result = await execute('git', ['-C', checkout, ...args], {
      env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1' },
    });
    return result.stdout.trimEnd();
  }
  async function prepare(intent: GitActionIntent) {
    const snapshot = await adapter.inspect(intent, signal());
    const preparation: GitActionCommand = {
      id: randomUUID(),
      intent,
      preview: snapshot.preview,
    };
    return { snapshot, preparation };
  }
  async function act(intent: GitActionIntent) {
    const { snapshot, preparation } = await prepare(intent);
    return adapter.execute(preparation, snapshot, signal());
  }
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'porcelain-write-git-'));
    vi.stubEnv('HOME', root);
    vi.stubEnv('XDG_CONFIG_HOME', root);
    vi.stubEnv('PATH', `${await createIsolatedGit(root)}:${process.env.PATH}`);
    checkout = join(root, 'checkout');
    await mkdir(checkout);
    await git('init', '-b', 'main');
    await git('config', 'user.name', 'Fixture');
    await git('config', 'user.email', 'fixture@example.invalid');
    await git('config', 'commit.gpgsign', 'false');
    await writeFile(join(checkout, 'file'), 'base\n');
    await git('add', 'file');
    await git('commit', '-m', 'base');
    const { repository } = await new Git(checkout).listWorktrees();
    const identity = repository.worktrees[0]?.metadataIdentity;
    if (!identity) throw new Error('Missing fixture identity');
    adapter = new ActionGit(
      new RequestGitSession().checkout(
        checkout,
        identity,
        repository.repositoryIdentity,
      ),
    );
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(root, { recursive: true, force: true });
  });

  describe('Committing the index', () => {
    it('commits the existing index while retaining unstaged and new files', async () => {
      await writeFile(join(checkout, 'file'), 'staged\n');
      await git('add', 'file');
      await writeFile(join(checkout, 'file'), 'unstaged\n');
      await writeFile(join(checkout, 'new'), 'new\n');
      expect(
        await act({ action: 'commit', message: 'selected index' }),
      ).toMatchObject({ state: 'succeeded' });
      expect(await git('show', 'HEAD:file')).toBe('staged');
      expect(await readFile(join(checkout, 'file'), 'utf8')).toBe('unstaged\n');
      expect(await git('status', '--porcelain')).toContain('?? new');
    });

    it('commits selected working files including new files while retaining unrelated staged content', async () => {
      await writeFile(join(checkout, 'file'), 'unrelated staged\n');
      await git('add', 'file');
      await writeFile(join(checkout, 'file'), 'unrelated working\n');
      await writeFile(join(checkout, 'new [literal]'), 'new file\n');
      expect(
        await act({
          action: 'commit',
          message: 'selected new file',
          paths: ['new [literal]'],
        }),
      ).toMatchObject({ state: 'succeeded' });
      expect(await git('show', 'HEAD:file')).toBe('base');
      expect(await git('show', ':file')).toBe('unrelated staged');
      expect(await git('show', 'HEAD:new [literal]')).toBe('new file');
      expect(await readFile(join(checkout, 'file'), 'utf8')).toBe(
        'unrelated working\n',
      );
    });

    it('leaves the actual index unchanged when a selected commit hook rejects it', async () => {
      await writeFile(join(checkout, 'new'), 'new file\n');
      const original = await readFile(join(checkout, '.git/index'));
      const head = await git('rev-parse', 'HEAD');
      const hook = join(checkout, '.git/hooks/pre-commit');
      await writeFile(hook, '#!/bin/sh\nexit 1\n');
      await chmod(hook, 0o700);
      expect(
        await act({
          action: 'commit',
          message: 'rejected new file',
          paths: ['new'],
        }),
      ).toMatchObject({ state: 'rejected' });
      expect(await readFile(join(checkout, '.git/index'))).toEqual(original);
      expect(await git('rev-parse', 'HEAD')).toBe(head);
    });

    it.each([false, true])(
      'commits selected deletions and both sides of a rename (staged: %s)',
      async (staged) => {
        await rm(join(checkout, 'file'));
        await writeFile(join(checkout, 'renamed'), 'base\n');
        if (staged) await git('add', '--all');
        expect(
          await act({
            action: 'commit',
            message: 'rename',
            paths: ['file', 'renamed'],
          }),
        ).toMatchObject({ state: 'succeeded' });
        expect(await git('status', '--porcelain')).toBe('');
        expect(await git('ls-tree', '--name-only', 'HEAD')).toBe('renamed');
      },
    );

    it('does not bypass a rejecting hook or its side effects', async () => {
      await writeFile(join(checkout, 'file'), 'staged\n');
      await git('add', 'file');
      const hook = join(checkout, '.git/hooks/pre-commit');
      await writeFile(
        hook,
        '#!/bin/sh\nprintf "hook effect" > side-effect\nexit 1\n',
      );
      await chmod(hook, 0o700);
      const previous = await git('rev-parse', 'HEAD');
      expect(
        await act({ action: 'commit', message: 'rejected' }),
      ).toMatchObject({
        state: 'rejected',
        refreshRequired: true,
      });
      expect(await git('rev-parse', 'HEAD')).toBe(previous);
      expect(await readFile(join(checkout, 'side-effect'), 'utf8')).toBe(
        'hook effect',
      );
    });

    it('honors a failing configured signer without unsigned fallback', async () => {
      await writeFile(join(checkout, 'file'), 'staged\n');
      await git('add', 'file');
      await git('config', 'commit.gpgsign', 'true');
      await git('config', 'gpg.program', '/usr/bin/false');
      const previous = await git('rev-parse', 'HEAD');
      expect(await act({ action: 'commit', message: 'signed' })).toMatchObject({
        state: 'rejected',
      });
      expect(await git('rev-parse', 'HEAD')).toBe(previous);
    });

    it('does not repeat or roll back a commit when cancellation occurs in its post-commit hook', async () => {
      const marker = join(root, 'post-commit-started');
      const hook = join(checkout, '.git/hooks/post-commit');
      await writeFile(
        hook,
        `#!/usr/bin/env node\nrequire('node:fs').writeFileSync(${JSON.stringify(marker)}, 'ready'); setInterval(() => {}, 1000);\n`,
      );
      await chmod(hook, 0o700);
      await writeFile(join(checkout, 'file'), 'selected\n');
      await git('add', 'file');
      const { snapshot, preparation } = await prepare({
        action: 'commit',
        message: 'partial acknowledgement',
      });
      const abort = new AbortController();
      const pending = adapter.execute(preparation, snapshot, abort.signal);
      try {
        await expect.poll(async () => readFile(marker, 'utf8')).toBe('ready');
        abort.abort();
        expect(await pending).toMatchObject({
          state: 'indeterminate',
          refreshRequired: true,
        });
        expect(await git('rev-list', '--count', 'HEAD')).toBe('2');
        expect(await git('show', 'HEAD:file')).toBe('selected');
      } finally {
        abort.abort();
        await pending;
      }
    });
  });
  describe('Stash creation, application and pop', () => {
    it.each([false, true])(
      'stash creation includes new files only when requested: %s',
      async (includeUntracked) => {
        await writeFile(join(checkout, '.gitignore'), 'ignored\n');
        await git('add', '.gitignore');
        await git('commit', '-m', 'ignore');
        await writeFile(join(checkout, 'file'), 'changed\n');
        await writeFile(join(checkout, 'new'), 'new\n');
        await writeFile(join(checkout, 'ignored'), 'ignored\n');
        const result = await act({
          action: 'stash-create',
          message: 'saved',
          includeUntracked,
        });
        expect(result).toMatchObject({
          state: 'succeeded',
          result: { stashRetained: true },
        });
        expect(await readFile(join(checkout, 'file'), 'utf8')).toBe('base\n');
        expect(await readFile(join(checkout, 'ignored'), 'utf8')).toBe(
          'ignored\n',
        );
        if (includeUntracked)
          await expect(readFile(join(checkout, 'new'))).rejects.toMatchObject({
            code: 'ENOENT',
          });
        else
          expect(await readFile(join(checkout, 'new'), 'utf8')).toBe('new\n');
      },
    );

    it.each(['stash-apply', 'stash-pop'] as const)(
      '%s restores staging and retains or removes only the selected stash',
      async (action) => {
        await writeFile(join(checkout, 'file'), 'staged\n');
        await git('add', 'file');
        await writeFile(join(checkout, 'file'), 'unstaged\n');
        await git('stash', 'push', '-m', 'selected');
        const stashOid = await git('rev-parse', 'refs/stash');
        expect(
          await act({ action, stashOid, restoreIndex: true }),
        ).toMatchObject({
          state: 'succeeded',
          result: { stashOid, stashRetained: action === 'stash-apply' },
        });
        expect(await git('show', ':file')).toBe('staged');
        expect(await readFile(join(checkout, 'file'), 'utf8')).toBe(
          'unstaged\n',
        );
        expect(Boolean(await git('stash', 'list'))).toBe(
          action === 'stash-apply',
        );
      },
    );

    it('pop removes a selected middle stash while preserving newer and older entries', async () => {
      await writeFile(join(checkout, 'file'), 'older\n');
      await git('stash', 'push', '-m', 'older');
      const olderOid = await git('rev-parse', 'refs/stash');
      await writeFile(join(checkout, 'file'), 'selected\n');
      await git('stash', 'push', '-m', 'selected');
      const stashOid = await git('rev-parse', 'refs/stash');
      await writeFile(join(checkout, 'file'), 'newer\n');
      await git('stash', 'push', '-m', 'newer');
      const newerOid = await git('rev-parse', 'refs/stash');
      expect(
        await act({ action: 'stash-pop', stashOid, restoreIndex: false }),
      ).toMatchObject({
        state: 'succeeded',
        result: { stashOid, stashRetained: false },
        refreshRequired: true,
      });
      expect(await readFile(join(checkout, 'file'), 'utf8')).toBe('selected\n');
      expect((await git('stash', 'list', '--format=%H')).split('\n')).toEqual([
        newerOid,
        olderOid,
      ]);
      expect(await git('show', `${newerOid}:file`)).toBe('newer');
      expect(await git('show', `${olderOid}:file`)).toBe('older');
    });

    it('pop retains the selected stash on application conflicts', async () => {
      await writeFile(join(checkout, 'file'), 'stash change\n');
      await git('stash', 'push');
      const stashOid = await git('rev-parse', 'refs/stash');
      await writeFile(join(checkout, 'file'), 'committed conflict\n');
      await git('add', 'file');
      await git('commit', '-m', 'conflict');
      expect(
        await act({ action: 'stash-pop', stashOid, restoreIndex: false }),
      ).toMatchObject({
        state: 'conflicted',
        result: { stashRetained: true },
        refreshRequired: true,
      });
      expect(await git('rev-parse', 'refs/stash')).toBe(stashOid);
      expect(await git('ls-files', '--unmerged')).not.toBe('');
    });

    it('pop retains a successfully applied stash when its reflog order changed', async () => {
      await writeFile(join(checkout, 'file'), 'older\n');
      await git('stash', 'push', '-m', 'older');
      const olderOid = await git('rev-parse', 'refs/stash');
      await writeFile(join(checkout, 'file'), 'selected\n');
      await git('stash', 'push', '-m', 'selected');
      const stashOid = await git('rev-parse', 'refs/stash');
      const { snapshot, preparation } = await prepare({
        action: 'stash-pop',
        stashOid,
        restoreIndex: false,
      });
      // A separate writer changes the shared reflog after preparation, without changing the index.
      await git('stash', 'store', '-m', 'external shift', olderOid);
      expect(
        await adapter.execute(preparation, snapshot, signal()),
      ).toMatchObject({
        state: 'indeterminate',
        result: { stashOid, stashRetained: true },
        refreshRequired: true,
      });
      expect(await readFile(join(checkout, 'file'), 'utf8')).toBe('selected\n');
      expect((await git('stash', 'list', '--format=%H')).split('\n')).toEqual([
        olderOid,
        stashOid,
        olderOid,
      ]);
    });

    it('rejects ignored-file collisions before stash application', async () => {
      await writeFile(join(checkout, 'new'), 'stash content');
      await git('stash', 'push', '--include-untracked');
      const stashOid = await git('rev-parse', 'refs/stash');
      await writeFile(join(checkout, '.gitignore'), 'new\n');
      await git('add', '.gitignore');
      await git('commit', '-m', 'ignore');
      await writeFile(join(checkout, 'new'), 'ignored content');
      await expect(
        prepare({ action: 'stash-pop', stashOid, restoreIndex: false }),
      ).rejects.toMatchObject({ reason: 'CHECKOUT_BUSY' });
      expect(await readFile(join(checkout, 'new'), 'utf8')).toBe(
        'ignored content',
      );
      expect(await git('rev-parse', 'refs/stash')).toBe(stashOid);
    });
  });
  describe('Remotes and transport policy', () => {
    it('fetch changes only the selected tracking ref and push sends only the captured branch', async () => {
      const remote = join(root, 'remote.git');
      await git('init', '--bare', remote);
      await git('remote', 'add', 'origin', remote);
      expect(
        await act({
          action: 'push',
          remoteName: 'origin',
          destinationRef: 'refs/heads/main',
          allowCreate: true,
        }),
      ).toMatchObject({ state: 'succeeded' });
      await writeFile(join(checkout, 'file'), 'dirty\n');
      expect(
        await act({
          action: 'fetch',
          remoteName: 'origin',
          sourceRef: 'refs/heads/main',
        }),
      ).toMatchObject({ state: 'no-change' });
      expect(await readFile(join(checkout, 'file'), 'utf8')).toBe('dirty\n');
      expect(
        await git(
          'for-each-ref',
          '--format=%(refname)',
          'refs/porcelain/fetch',
        ),
      ).toBe('');
    });

    it('pulls a clean branch by fast-forward and rejects divergence or local changes', async () => {
      const remote = join(root, 'pull-remote.git');
      await git('init', '--bare', remote);
      await git('remote', 'add', 'origin', remote);
      await git('push', '-u', 'origin', 'main');
      const base = await git('rev-parse', 'HEAD');
      await writeFile(join(checkout, 'file'), 'remote change\n');
      await git('commit', '-am', 'remote advance');
      const tip = await git('rev-parse', 'HEAD');
      await git('push', 'origin', 'main');
      await git('reset', '--hard', base);
      expect(
        await act({
          action: 'pull',
          remoteName: 'origin',
          sourceRef: 'refs/heads/main',
        }),
      ).toMatchObject({ state: 'succeeded', result: { headOid: tip } });
      expect(await readFile(join(checkout, 'file'), 'utf8')).toBe(
        'remote change\n',
      );
      await writeFile(join(checkout, 'file'), 'local change\n');
      await expect(
        prepare({
          action: 'pull',
          remoteName: 'origin',
          sourceRef: 'refs/heads/main',
        }),
      ).rejects.toMatchObject({ reason: 'CHECKOUT_BUSY' });
      await git('reset', '--hard', base);
      await writeFile(join(checkout, 'file'), 'diverged\n');
      await git('commit', '-am', 'diverge');
      const local = await git('rev-parse', 'HEAD');
      expect(
        await act({
          action: 'pull',
          remoteName: 'origin',
          sourceRef: 'refs/heads/main',
        }),
      ).toMatchObject({ state: 'rejected', reason: 'NON_FAST_FORWARD' });
      expect(await git('rev-parse', 'HEAD')).toBe(local);
    });

    it.each(['merge', 'rebase'] as const)(
      'pulls divergent commits with %s and leaves an ahead branch unchanged',
      async (strategy) => {
        const remote = join(root, 'strategy-remote.git');
        await git('init', '--bare', remote);
        await git('remote', 'add', 'origin', remote);
        const base = await git('rev-parse', 'HEAD');
        await writeFile(join(checkout, 'remote'), 'upstream\n');
        await git('add', 'remote');
        await git('commit', '-m', 'upstream');
        const upstream = await git('rev-parse', 'HEAD');
        await git('push', '-u', 'origin', 'main');
        await git('reset', '--hard', base);
        await writeFile(join(checkout, 'local'), 'local\n');
        await git('add', 'local');
        await git('commit', '-m', 'local');
        const local = await git('rev-parse', 'HEAD');
        const intent = {
          action: 'pull',
          remoteName: 'origin',
          sourceRef: 'refs/heads/main',
          strategy,
        } as const;
        expect(await act(intent)).toMatchObject({
          state: 'succeeded',
          result: { trackingOid: upstream },
        });
        const tip = await git('rev-parse', 'HEAD');
        expect(await git('show', 'HEAD:local')).toBe('local');
        expect(await git('show', 'HEAD:remote')).toBe('upstream');
        if (strategy === 'merge') {
          expect(await git('show', '-s', '--format=%P', 'HEAD')).toBe(
            `${local} ${upstream}`,
          );
        } else {
          expect(await git('show', '-s', '--format=%P', 'HEAD')).toBe(upstream);
          expect(tip).not.toBe(local);
        }
        expect(await act(intent)).toMatchObject({
          state: 'no-change',
          result: { headOid: tip },
        });
        expect(await git('rev-parse', 'HEAD')).toBe(tip);
      },
    );

    it.each(['merge', 'rebase'] as const)(
      'reports %s conflicts, blocks new actions, and permits recovery after abort',
      async (strategy) => {
        const remote = join(root, 'conflict-remote.git');
        await git('init', '--bare', remote);
        await git('remote', 'add', 'origin', remote);
        const base = await git('rev-parse', 'HEAD');
        await writeFile(join(checkout, 'file'), 'upstream\n');
        await git('commit', '-am', 'upstream');
        await git('push', '-u', 'origin', 'main');
        await git('reset', '--hard', base);
        await writeFile(join(checkout, 'file'), 'local\n');
        await git('commit', '-am', 'local');
        const local = await git('rev-parse', 'HEAD');
        const intent = {
          action: 'pull',
          remoteName: 'origin',
          sourceRef: 'refs/heads/main',
          strategy,
        } as const;
        expect(await act(intent)).toMatchObject({ state: 'conflicted' });
        expect(await git('ls-files', '--unmerged')).not.toBe('');
        await expect(prepare(intent)).rejects.toMatchObject({
          reason: 'CHECKOUT_BUSY',
        });
        await git(strategy, '--abort');
        expect(await git('rev-parse', 'HEAD')).toBe(local);
        expect(await git('status', '--porcelain')).toBe('');
        await expect(prepare(intent)).resolves.toBeDefined();
      },
    );

    it('commits selected new files before the first commit', async () => {
      await git('checkout', '--orphan', 'new-history');
      await git('rm', '-rf', '.');
      await writeFile(join(checkout, 'first'), 'first\n');
      expect(
        await act({ action: 'commit', message: 'first', paths: ['first'] }),
      ).toMatchObject({ state: 'succeeded' });
      expect(await git('show', 'HEAD:first')).toBe('first');
    });

    it("runs the repository's core.sshCommand with its arguments, and gives it no terminal even when the server has one", async () => {
      const remote = join(root, 'ssh-remote.git');
      await git('init', '--bare', remote);
      const ssh = join(root, 'account ssh');
      const identity = join(root, 'keys', 'second account');
      const argumentsPath = join(root, 'ssh-arguments');
      const terminalPath = join(root, 'terminal');
      const resultPath = join(root, 'result.json');
      await writeFile(
        ssh,
        `#!/bin/sh\nprintf '%s\\n' "$@" > '${argumentsPath}'\nif (exec 3</dev/tty) 2>/dev/null; then echo opened; else echo unavailable; fi >> '${terminalPath}'\nfor argument in "$@"; do last="$argument"; done\ncase "$last" in git-receive-pack*|git-upload-pack*) exec /bin/sh -c "$last";; *) exit 0;; esac\n`,
      );
      await chmod(ssh, 0o700);
      await git('config', 'core.sshCommand', `'${ssh}' -i '${identity}'`);
      await git('remote', 'add', 'fixture', `ssh://fixture.invalid${remote}`);
      // The action runs in a process that owns a pseudo-terminal, as a server
      // started from a shell does. It records that it can open that terminal
      // before running the push, so an unavailable one below means Git's ssh
      // was cut off from it rather than that there was none to open.
      const server = join(root, 'server.ts');
      await writeFile(
        server,
        `import { appendFileSync, closeSync, openSync, writeFileSync } from 'node:fs';
import { ActionGit } from ${JSON.stringify(join(import.meta.dirname, 'action-git.ts'))};
import { Git } from ${JSON.stringify(join(import.meta.dirname, 'git.ts'))};
import { RequestGitSession } from ${JSON.stringify(join(import.meta.dirname, 'git-session.ts'))};
closeSync(openSync('/dev/tty', 'r'));
appendFileSync(${JSON.stringify(terminalPath)}, 'opened\\n');
const checkout = ${JSON.stringify(checkout)};
const { repository } = await new Git(checkout).listWorktrees();
const adapter = new ActionGit(
  new RequestGitSession().checkout(checkout, repository.worktrees[0].metadataIdentity, repository.repositoryIdentity),
);
const intent = { action: 'push', remoteName: 'fixture', destinationRef: 'refs/heads/main', allowCreate: true };
const snapshot = await adapter.inspect(intent, AbortSignal.timeout(15_000));
const command = { id: crypto.randomUUID(), intent, preview: snapshot.preview };
writeFileSync(${JSON.stringify(resultPath)}, JSON.stringify(await adapter.execute(command, snapshot, AbortSignal.timeout(15_000))));
`,
      );
      await execute(
        'python3',
        [
          '-c',
          'import pty, sys; sys.exit(pty.spawn(sys.argv[1:]) >> 8)',
          process.execPath,
          server,
        ],
        { env: process.env, timeout: 30_000 },
      );
      expect(JSON.parse(await readFile(resultPath, 'utf8'))).toMatchObject({
        state: 'succeeded',
      });
      // Git may start the command more than once, e.g. `-G` to identify it.
      expect(await readFile(terminalPath, 'utf8')).toMatch(
        /^opened\n(unavailable\n)+$/,
      );
      const args = (await readFile(argumentsPath, 'utf8'))
        .trimEnd()
        .split('\n');
      expect(args.slice(0, 2)).toEqual(['-i', identity]);
      expect(args).toContain('fixture.invalid');
      expect(args.at(-1)).toBe(`git-receive-pack '${remote}'`);
      expect(
        await execute('git', ['-C', remote, 'rev-parse', 'refs/heads/main']),
      ).toMatchObject({ stdout: `${await git('rev-parse', 'HEAD')}\n` });
    });

    it.skipIf(!sshdAvailable)(
      'fails through real ssh on an unknown host key or a refused key instead of prompting',
      async () => {
        const remote = join(root, 'ssh-remote.git');
        await git('init', '--bare', remote);
        const hostKey = join(root, 'host key');
        const identity = join(root, 'account key');
        for (const key of [hostKey, identity])
          await execute('ssh-keygen', [
            '-q',
            '-t',
            'ed25519',
            '-N',
            '',
            '-f',
            key,
          ]);
        const authorizedKeys = join(root, 'authorized_keys');
        const knownHosts = join(root, 'known_hosts');
        const serverConfig = join(root, 'sshd_config');
        const clientConfig = join(root, 'ssh_config');
        // A disposable sshd answers over the proxy's pipes, so nothing listens
        // and nothing from the owner's ~/.ssh or agent takes part. It stands in
        // for a remote host, so it runs outside the action's process group.
        // Both cases end before a session, which would run the owner's shell.
        await writeFile(
          serverConfig,
          `HostKey "${hostKey}"\nAuthorizedKeysFile "${authorizedKeys}"\nUsePAM no\nStrictModes no\nPermitUserRC no\nPidFile none\n`,
        );
        await writeFile(
          clientConfig,
          `Host fixture.invalid\n  ProxyCommand perl -MPOSIX -e "POSIX::setsid(); exec @ARGV" ${sshd} -i -f "${serverConfig}"\n  UserKnownHostsFile "${knownHosts}"\n  GlobalKnownHostsFile /dev/null\n  IdentityAgent none\n  IdentitiesOnly yes\n`,
        );
        await git(
          'config',
          'core.sshCommand',
          `ssh -F '${clientConfig}' -i '${identity}'`,
        );
        await git('remote', 'add', 'fixture', `ssh://fixture.invalid${remote}`);
        const push = () =>
          act({
            action: 'push',
            remoteName: 'fixture',
            destinationRef: 'refs/heads/main',
            allowCreate: true,
          });

        expect(await push()).toMatchObject({
          state: 'indeterminate',
          reason: 'GIT_REJECTED',
          message: expect.stringContaining('Host key verification failed'),
        });
        const hostPublic = await readFile(`${hostKey}.pub`, 'utf8');
        await writeFile(
          knownHosts,
          `fixture.invalid ${hostPublic.split(' ').slice(0, 2).join(' ')}\n`,
        );
        expect(await push()).toMatchObject({
          state: 'indeterminate',
          reason: 'GIT_REJECTED',
          message: expect.stringContaining('Permission denied'),
        });
        expect(
          (
            await execute('git', [
              '-C',
              remote,
              'for-each-ref',
              '--format=%(refname)',
            ])
          ).stdout,
        ).toBe('');
      },
    );

    it('rejects hidden credential-helper chains, interactive keychain and multiple push targets before transport', async () => {
      await git(
        'remote',
        'add',
        'fixture',
        'https://fixture.invalid/repository',
      );
      await git('config', '--add', 'credential.helper', '');
      await git('config', '--add', 'credential.helper', '!exit 42');
      await git('config', '--add', 'credential.helper', 'store');
      await expect(
        prepare({
          action: 'fetch',
          remoteName: 'fixture',
          sourceRef: 'refs/heads/main',
        }),
      ).rejects.toMatchObject({ reason: 'UNSUPPORTED_CONFIGURATION' });
      await git('config', '--unset-all', 'credential.helper');
      await git('config', '--add', 'credential.helper', '');
      await git('config', '--add', 'credential.helper', 'osxkeychain');
      await expect(
        prepare({
          action: 'fetch',
          remoteName: 'fixture',
          sourceRef: 'refs/heads/main',
        }),
      ).rejects.toMatchObject({ reason: 'UNSUPPORTED_CONFIGURATION' });
      await git(
        'remote',
        'set-url',
        '--add',
        '--push',
        'fixture',
        join(root, 'first'),
      );
      await git(
        'remote',
        'set-url',
        '--add',
        '--push',
        'fixture',
        join(root, 'second'),
      );
      await expect(
        prepare({
          action: 'push',
          remoteName: 'fixture',
          destinationRef: 'refs/heads/main',
          allowCreate: true,
        }),
      ).rejects.toMatchObject({ reason: 'UNSUPPORTED_CONFIGURATION' });
    });

    it('fetches over disposable HTTPS with existing stored credentials and configured TLS trust', async () => {
      const remote = join(root, 'https-remote.git');
      await git('init', '--bare', remote);
      await git('push', remote, 'refs/heads/main:refs/heads/main');
      await execute('git', ['-C', remote, 'update-server-info']);
      const key = join(root, 'key.pem');
      const cert = join(root, 'cert.pem');
      const config = join(root, 'openssl.cnf');
      await writeFile(
        config,
        '[req]\nprompt=no\ndistinguished_name=dn\nx509_extensions=v3\n[dn]\nCN=localhost\n[v3]\nsubjectAltName=DNS:localhost\n',
      );
      await execute('openssl', [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-days',
        '1',
        '-keyout',
        key,
        '-out',
        cert,
        '-config',
        config,
      ]);
      const authentication = { challenged: false, accepted: false };
      const server = createHttpsServer(
        { key: await readFile(key), cert: await readFile(cert) },
        (request, response) => {
          if (
            request.headers.authorization !==
            `Basic ${Buffer.from('fixture:disposable').toString('base64')}`
          ) {
            authentication.challenged = true;
            response.writeHead(401, {
              'www-authenticate': 'Basic realm="fixture"',
            });
            response.end();
            return;
          }
          authentication.accepted = true;
          const pathname = new URL(request.url ?? '/', 'https://localhost')
            .pathname;
          const path = join(remote, pathname);
          if (relative(remote, path).startsWith('..')) {
            response.writeHead(404);
            response.end();
            return;
          }
          void readFile(path).then(
            (body) => {
              response.writeHead(200, { 'content-type': 'text/plain' });
              response.end(body);
            },
            () => {
              response.writeHead(404);
              response.end();
            },
          );
        },
      );
      await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', resolve),
      );
      try {
        const address = server.address();
        if (!address || typeof address === 'string')
          throw new Error('Missing address');
        await writeFile(
          join(root, '.git-credentials'),
          `https://fixture:disposable@localhost:${address.port}\n`,
          { mode: 0o600 },
        );
        await git('config', '--add', 'credential.helper', '');
        await git('config', '--add', 'credential.helper', 'store');
        await git('config', 'http.sslCAInfo', cert);
        await git(
          'remote',
          'add',
          'fixture',
          `https://localhost:${address.port}`,
        );
        expect(
          await act({
            action: 'fetch',
            remoteName: 'fixture',
            sourceRef: 'refs/heads/main',
          }),
        ).toMatchObject({ state: 'succeeded' });
        expect(authentication).toEqual({ challenged: true, accepted: true });
        expect(await git('rev-parse', 'refs/remotes/fixture/main')).toBe(
          await git('rev-parse', 'HEAD'),
        );
      } finally {
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
      }
    });

    it('rejects fetch rewinds and divergent pushes without replacing their target refs', async () => {
      const remote = join(root, 'remote.git');
      await git('init', '--bare', remote);
      await git('remote', 'add', 'fixture', remote);
      const base = await git('rev-parse', 'HEAD');
      await writeFile(join(checkout, 'file'), 'later\n');
      await git('add', 'file');
      await git('commit', '-m', 'later');
      const later = await git('rev-parse', 'HEAD');
      await git('push', 'fixture', 'refs/heads/main:refs/heads/main');
      await execute('git', [
        '-C',
        remote,
        'update-ref',
        'refs/heads/main',
        base,
      ]);
      expect(
        await act({
          action: 'fetch',
          remoteName: 'fixture',
          sourceRef: 'refs/heads/main',
        }),
      ).toMatchObject({ state: 'rejected', reason: 'NON_FAST_FORWARD' });
      expect(await git('rev-parse', 'refs/remotes/fixture/main')).toBe(later);
      expect(
        await git(
          'for-each-ref',
          '--format=%(refname)',
          'refs/porcelain/fetch',
        ),
      ).toBe('');
      await execute('git', [
        '-C',
        remote,
        'update-ref',
        'refs/heads/main',
        later,
      ]);
      await git('reset', '--hard', base);
      expect(
        await act({
          action: 'push',
          remoteName: 'fixture',
          destinationRef: 'refs/heads/main',
          allowCreate: false,
        }),
      ).toMatchObject({ state: 'indeterminate', refreshRequired: true });
      expect(
        (
          await execute('git', ['-C', remote, 'rev-parse', 'refs/heads/main'])
        ).stdout.trim(),
      ).toBe(later);
    });

    it.each([false, true])(
      'checks branch existence on the actual push destination: present=%s',
      async (existsOnPush) => {
        const fetchRemote = join(root, 'fetch.git');
        const pushRemote = join(root, 'push.git');
        await git('init', '--bare', fetchRemote);
        await git('init', '--bare', pushRemote);
        await git(
          'push',
          existsOnPush ? pushRemote : fetchRemote,
          'refs/heads/main:refs/heads/main',
        );
        await git('remote', 'add', 'fixture', fetchRemote);
        await git('remote', 'set-url', '--push', 'fixture', pushRemote);
        await writeFile(join(checkout, 'file'), 'later\n');
        await git('add', 'file');
        await git('commit', '-m', 'later');
        const outcome = await act({
          action: 'push',
          remoteName: 'fixture',
          destinationRef: 'refs/heads/main',
          allowCreate: false,
        });
        if (existsOnPush) {
          expect(outcome).toMatchObject({ state: 'succeeded' });
          expect(
            (
              await execute('git', [
                '-C',
                pushRemote,
                'rev-parse',
                'refs/heads/main',
              ])
            ).stdout.trim(),
          ).toBe(await git('rev-parse', 'HEAD'));
        } else {
          expect(outcome).toMatchObject({
            state: 'rejected',
            refreshRequired: false,
          });
          expect(
            (
              await execute('git', [
                '-C',
                pushRemote,
                'for-each-ref',
                '--format=%(refname)',
              ])
            ).stdout,
          ).toBe('');
        }
      },
    );

    it('rejects a second URL rewrite instead of checking a third repository for push creation', async () => {
      const original = join(root, 'original.git');
      const destination = join(root, 'destination.git');
      const third = join(root, 'third.git');
      await git('init', '--bare', destination);
      await git('init', '--bare', third);
      await git('push', third, 'refs/heads/main:refs/heads/main');
      await git('remote', 'add', 'fixture', original);
      await git('config', `url.${destination}.insteadOf`, original);
      await git('config', `url.${third}.insteadOf`, destination);
      await expect(
        act({
          action: 'push',
          remoteName: 'fixture',
          destinationRef: 'refs/heads/main',
          allowCreate: false,
        }),
      ).rejects.toMatchObject({ reason: 'UNSUPPORTED_CONFIGURATION' });
      expect(
        (
          await execute('git', [
            '-C',
            destination,
            'for-each-ref',
            '--format=%(refname)',
          ])
        ).stdout,
      ).toBe('');
    });
  });
  describe('Preparation evidence and configuration', () => {
    it('fingerprints same-size working changes, configuration changes and index changes', async () => {
      const intent: GitActionIntent = { action: 'commit', message: 'test' };
      const first = await adapter.inspect(intent, signal());
      await writeFile(join(checkout, 'file'), 'edit\n');
      const second = await adapter.inspect(intent, signal());
      expect(second.fingerprint).not.toBe(first.fingerprint);
      await git('config', 'user.name', 'Other');
      const third = await adapter.inspect(intent, signal());
      expect(third.fingerprint).not.toBe(second.fingerprint);
      await git('add', 'file');
      expect((await adapter.inspect(intent, signal())).fingerprint).not.toBe(
        third.fingerprint,
      );
    });

    it('continues to reject configured conversion filters before mutation', async () => {
      await git(
        'config',
        'filter.fixture.clean',
        'fixture-filter-not-executed',
      );
      await expect(
        prepare({ action: 'commit', message: 'unsupported filter' }),
      ).rejects.toMatchObject({
        reason: 'UNSUPPORTED_CONFIGURATION',
        detail: expect.stringContaining('filter.fixture.clean'),
      });
      expect(await git('rev-list', '--count', 'HEAD')).toBe('1');
    });
  });
});
