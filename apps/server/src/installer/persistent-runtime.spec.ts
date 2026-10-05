import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installRuntime, PACKAGE_NAME } from './persistent-runtime.ts';

type Answer = { code: number; stdout: string; stderr: string };

const serviceNode = '/opt/service/bin/node';
const source = '/packages/porcelain-1.2.0.tgz';
const workingWatcher = 'module.exports = { subscribe() {} };';

let root: string;
let destination: string;
let npmAnswer: Answer;
let installedVersion: string;
let modules: Record<string, string | undefined>;
let commands: string[];
let sqliteAvailable = true;

function writeModule(prefix: string, name: string, body: string) {
  const folder = join(prefix, 'node_modules', name);
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, 'index.js'), body);
}

function npmInstall(args: readonly string[]): Answer {
  if (npmAnswer.code !== 0) return npmAnswer;
  const prefix = args[args.indexOf('--prefix') + 1] ?? '';
  writeModule(prefix, PACKAGE_NAME, '');
  writeFileSync(
    join(prefix, 'node_modules', PACKAGE_NAME, 'package.json'),
    JSON.stringify({ name: PACKAGE_NAME, version: installedVersion }),
  );
  for (const [name, body] of Object.entries(modules))
    if (body !== undefined) writeModule(prefix, name, body);
  return npmAnswer;
}

async function runner(command: string, args: readonly string[]) {
  commands.push(command);
  if (command === 'npm' && args[0] === 'install' && args.at(-1) === source)
    return npmInstall(args);
  if (command === serviceNode) {
    const run = spawnSync(
      process.execPath,
      sqliteAvailable ? args : ['--no-experimental-sqlite', ...args],
      {
        encoding: 'utf8',
        env: { ...process.env, NODE_PATH: '' },
      },
    );
    return { code: run.status ?? 1, stdout: run.stdout, stderr: run.stderr };
  }
  return { code: 1, stdout: '', stderr: `unexpected ${command}` };
}

const install = () =>
  installRuntime(runner, serviceNode, source, destination, '1.2.0');

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'porcelain-runtime-'));
  destination = join(root, 'runtime.next');
  npmAnswer = { code: 0, stdout: '', stderr: '' };
  installedVersion = '1.2.0';
  modules = {
    '@parcel/watcher': workingWatcher,
  };
  commands = [];
  sqliteAvailable = true;
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('installing the persistent runtime', () => {
  it('accepts a fresh install whose native modules load in the node the service runs', async () => {
    mkdirSync(destination, { recursive: true });
    writeFileSync(join(destination, 'leftover'), 'from an earlier attempt');
    await install();
    expect(commands).toEqual(['npm', serviceNode]);
    expect(existsSync(join(destination, 'leftover'))).toBe(false);
  });

  it('refuses a service node without its built-in SQLite and names the reason', async () => {
    sqliteAvailable = false;
    await expect(install()).rejects.toThrow(
      /cannot load its native modules.*No such built-in module: node:sqlite$/,
    );
  });

  it('refuses a runtime missing its file watcher and names the reason', async () => {
    modules = { '@parcel/watcher': undefined };
    await expect(install()).rejects.toThrow(
      /cannot load its native modules.*Cannot find module '@parcel\/watcher'/,
    );
  });

  it("reports npm's own reason when the install fails and checks nothing further", async () => {
    npmAnswer = { code: 1, stdout: '', stderr: 'npm error 404 Not Found\n' };
    await expect(install()).rejects.toThrow(
      'Could not install the persistent runtime: npm error 404 Not Found',
    );
    expect(commands).toEqual(['npm']);
  });

  it('refuses a runtime that reports another version before loading anything from it', async () => {
    installedVersion = '1.1.0';
    await expect(install()).rejects.toThrow(
      'Persistent runtime reported 1.1.0 instead of 1.2.0.',
    );
    expect(commands).toEqual(['npm']);
  });
});
