import { execFileSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { repositoryRoot } from './test-configuration.ts';

it('reuses outputs and invalidates consumers for Git, server, configuration and runtime changes', () => {
  const root = mkdtempSync(join(tmpdir(), 'porcelain-turbo-proof-'));
  const turbo = resolve(repositoryRoot, 'node_modules/.bin/turbo');
  function write(path: string, value: string) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), value);
  }
  function run(dry = false, runtime = 'fixture-linux') {
    return execFileSync(
      turbo,
      ['run', 'test:coverage', 'test:tooling', ...(dry ? ['--dry=json'] : [])],
      {
        cwd: root,
        env: {
          ...process.env,
          CI: '1',
          TURBO_TELEMETRY_DISABLED: '1',
          PORCELAIN_RUNTIME_FINGERPRINT: runtime,
        },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
  }
  function hashes(runtime?: string) {
    const result = JSON.parse(run(true, runtime)) as {
      tasks: {
        taskId: string;
        hash: string;
        cache: { status: string };
        command: string;
      }[];
    };
    return Object.fromEntries(
      result.tasks
        .filter((task) => task.command !== '<NONEXISTENT>')
        .map((task) => [task.taskId, task]),
    );
  }
  try {
    for (const path of [
      'turbo.json',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      'tsconfig.json',
      '.node-version',
      '.gitignore',
    ])
      cpSync(resolve(repositoryRoot, path), join(root, path));
    for (const owner of [
      '',
      'packages/git',
      'packages/contracts',
      'apps/server',
    ]) {
      const manifest = JSON.parse(
        readFileSync(resolve(repositoryRoot, owner, 'package.json'), 'utf8'),
      );
      const output = owner ? 'coverage' : 'coverage/tooling';
      const command = `node -e "require('node:fs').mkdirSync('${output}',{recursive:true});require('node:fs').writeFileSync('${output}/proof.txt','verified')"`;
      manifest.scripts = owner
        ? {
            typecheck: 'node -e ""',
            'test:coverage': command,
          }
        : { 'test:tooling': command };
      write(join(owner, 'package.json'), JSON.stringify(manifest));
      write(
        join(owner, owner ? 'src/proof.ts' : 'scripts/proof.ts'),
        'export const proof = 1;',
      );
    }
    execFileSync('git', ['init'], { cwd: root, stdio: 'ignore' });
    execFileSync('git', ['add', '.'], { cwd: root });
    const initial = hashes();
    run();
    const warm = hashes();
    expect(
      Object.fromEntries(
        Object.entries(warm).map(([id, task]) => [id, task.cache.status]),
      ),
    ).toEqual(Object.fromEntries(Object.keys(warm).map((id) => [id, 'HIT'])));
    rmSync(join(root, 'packages/git/coverage'), { recursive: true });
    run();
    expect(
      readFileSync(join(root, 'packages/git/coverage/proof.txt'), 'utf8'),
    ).toBe('verified');
    write('apps/server/src/proof.ts', 'export const proof = 2;');
    const server = hashes();
    expect(server['@porcelain/git#test:coverage']?.hash).toBe(
      initial['@porcelain/git#test:coverage']?.hash,
    );
    expect(server['@porcelain/server#test:coverage']?.hash).not.toBe(
      initial['@porcelain/server#test:coverage']?.hash,
    );
    write('packages/git/src/proof.ts', 'export const proof = 2;');
    const git = hashes();
    expect(git['@porcelain/git#test:coverage']?.hash).not.toBe(
      server['@porcelain/git#test:coverage']?.hash,
    );
    expect(git['@porcelain/server#test:coverage']?.hash).not.toBe(
      server['@porcelain/server#test:coverage']?.hash,
    );
    write(
      'tsconfig.json',
      `${readFileSync(join(root, 'tsconfig.json'), 'utf8')}\n`,
    );
    const config = hashes();
    for (const id of Object.keys(config))
      expect(config[id]?.hash).not.toBe(git[id]?.hash);
    const runtime = hashes('fixture-macos');
    for (const id of Object.keys(runtime))
      expect(runtime[id]?.hash).not.toBe(config[id]?.hash);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 30_000);
