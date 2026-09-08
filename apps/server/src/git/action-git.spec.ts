import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
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
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type {
  GitActionIntent,
  GitActionPreparation,
} from '../models/git-action.ts';
import { ActionGit } from './action-git.ts';
import { createIsolatedGit } from './fixtures/isolated-git.ts';
import { Git } from './git.ts';

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
  const preparation: GitActionPreparation = {
    id: randomUUID(),
    projectId: randomUUID(),
    worktreeId: randomUUID(),
    expiresAt: Date.now() + 300_000,
    intent,
    fingerprint: snapshot.fingerprint,
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
  adapter = new ActionGit(checkout, identity, repository.repositoryIdentity);
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(root, { recursive: true, force: true });
});

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
  expect(await act({ action: 'commit', message: 'rejected' })).toMatchObject({
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
    expect(await readFile(join(checkout, 'ignored'), 'utf8')).toBe('ignored\n');
    if (includeUntracked)
      await expect(readFile(join(checkout, 'new'))).rejects.toMatchObject({
        code: 'ENOENT',
      });
    else expect(await readFile(join(checkout, 'new'), 'utf8')).toBe('new\n');
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
    expect(await act({ action, stashOid, restoreIndex: true })).toMatchObject({
      state: 'succeeded',
      result: { stashOid, stashRetained: action === 'stash-apply' },
    });
    expect(await git('show', ':file')).toBe('staged');
    expect(await readFile(join(checkout, 'file'), 'utf8')).toBe('unstaged\n');
    expect(Boolean(await git('stash', 'list'))).toBe(action === 'stash-apply');
  },
);

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
    await git('for-each-ref', '--format=%(refname)', 'refs/porcelain/fetch'),
  ).toBe('');
});

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
  expect(await adapter.execute(preparation, snapshot, signal())).toMatchObject({
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

it('uses SSH batch and existing host-key policy with a disposable transport substitute', async () => {
  const remote = join(root, 'ssh-remote.git');
  await git('init', '--bare', remote);
  const bin = join(root, 'bin');
  await mkdir(bin);
  const ssh = join(bin, 'ssh');
  const argumentsPath = join(root, 'ssh-arguments');
  await writeFile(
    ssh,
    `#!/bin/sh\nprintf '%s\\n' "$@" > '${argumentsPath}'\nfor argument in "$@"; do last="$argument"; done\ncase "$last" in git-receive-pack*|git-upload-pack*) exec /bin/sh -c "$last";; *) exit 0;; esac\n`,
  );
  await chmod(ssh, 0o700);
  vi.stubEnv('PATH', `${bin}:${process.env.PATH}`);
  await git('remote', 'add', 'fixture', `ssh://fixture.invalid${remote}`);
  expect(
    await act({
      action: 'push',
      remoteName: 'fixture',
      destinationRef: 'refs/heads/main',
      allowCreate: true,
    }),
  ).toMatchObject({ state: 'succeeded' });
  const args = await readFile(argumentsPath, 'utf8');
  expect(args).toContain('-oBatchMode=yes');
  expect(args).toContain('-oStrictHostKeyChecking=yes');
  expect(args).toContain('-oNumberOfPasswordPrompts=0');
});

it('rejects hidden credential-helper chains, interactive keychain and multiple push targets before transport', async () => {
  await git('remote', 'add', 'fixture', 'https://fixture.invalid/repository');
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
  expect(await readFile(join(checkout, 'new'), 'utf8')).toBe('ignored content');
  expect(await git('rev-parse', 'refs/stash')).toBe(stashOid);
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
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
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
    await git('remote', 'add', 'fixture', `https://localhost:${address.port}`);
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
  await execute('git', ['-C', remote, 'update-ref', 'refs/heads/main', base]);
  expect(
    await act({
      action: 'fetch',
      remoteName: 'fixture',
      sourceRef: 'refs/heads/main',
    }),
  ).toMatchObject({ state: 'rejected', reason: 'NON_FAST_FORWARD' });
  expect(await git('rev-parse', 'refs/remotes/fixture/main')).toBe(later);
  expect(
    await git('for-each-ref', '--format=%(refname)', 'refs/porcelain/fetch'),
  ).toBe('');
  await execute('git', ['-C', remote, 'update-ref', 'refs/heads/main', later]);
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

it('continues to reject configured conversion filters before mutation', async () => {
  await git('config', 'filter.fixture.clean', 'fixture-filter-not-executed');
  await expect(
    prepare({ action: 'commit', message: 'unsupported filter' }),
  ).rejects.toMatchObject({ reason: 'UNSUPPORTED_CONFIGURATION' });
  expect(await git('rev-list', '--count', 'HEAD')).toBe('1');
});
