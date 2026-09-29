import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openServiceUpdateRunner } from './service-update-runner.ts';

type Answer = { code: number; stdout: string; stderr: string };

let home: string;
let published: string;
let updaterActive: boolean;
let npmViews: number;

const packageName = '@fabiofiorita/porcelain';
const runtimePackage = () =>
  join(
    home,
    '.local/share/porcelain/service/runtime/node_modules',
    packageName,
  );

async function answer(command: string, args: readonly string[]) {
  const ok = (stdout: string): Answer => ({ code: 0, stdout, stderr: '' });
  if (command === 'npm' && args[0] === 'view') {
    npmViews += 1;
    return ok(JSON.stringify(published));
  }
  if (command === 'systemctl')
    return updaterActive
      ? ok('active\n')
      : { code: 3, stdout: 'inactive\n', stderr: '' };
  return { code: 1, stdout: '', stderr: `unexpected ${command}` };
}

function install(version: string) {
  mkdirSync(runtimePackage(), { recursive: true });
  writeFileSync(
    join(runtimePackage(), 'package.json'),
    JSON.stringify({ name: packageName, version }),
  );
  writeFileSync(
    join(home, '.local/share/porcelain/service/installed.json'),
    JSON.stringify({ version }),
  );
}

const runner = (packageRoot = runtimePackage()) =>
  openServiceUpdateRunner({
    homeDirectory: home,
    packageRoot,
    searchPath: '/usr/bin',
    command: {
      timeoutMs: 1000,
      maxBytes: 1024,
      processGroup: { lingerMs: 10, cleanupMs: 10, pollMs: 1 },
    },
    runner: answer,
  });
const check = (now: string, staleBefore: string) => ({ now, staleBefore });

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'porcelain-service-updates-'));
  published = '1.1.0';
  updaterActive = false;
  npmViews = 0;
  install('1.0.0');
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
});

describe('the installed service update runner', () => {
  it('offers the newer published version to the installed service', async () => {
    expect(
      await runner().read(
        check('2026-09-29T12:00:00.000Z', '2026-09-29T11:50:00.000Z'),
      ),
    ).toEqual({
      managed: true,
      version: '1.0.0',
      latest: '1.1.0',
      available: true,
      running: false,
      last: undefined,
    });
  });

  it('asks the registry again only once its last answer is older than the freshness window', async () => {
    const updates = runner();
    await updates.read(
      check('2026-09-29T12:00:00.000Z', '2026-09-29T11:50:00.000Z'),
    );
    published = '1.2.0';
    const fresh = await updates.read(
      check('2026-09-29T12:05:00.000Z', '2026-09-29T11:55:00.000Z'),
    );
    expect(fresh.latest).toBe('1.1.0');
    expect(npmViews).toBe(1);
    const stale = await updates.read(
      check('2026-09-29T12:11:00.000Z', '2026-09-29T12:01:00.000Z'),
    );
    expect(stale.latest).toBe('1.2.0');
    expect(npmViews).toBe(2);
  });

  it('does not ask the registry while an update runs', async () => {
    updaterActive = true;
    const state = await runner().read(
      check('2026-09-29T12:00:00.000Z', '2026-09-29T11:50:00.000Z'),
    );
    expect(state.running).toBe(true);
    expect(npmViews).toBe(0);
  });

  it('stops a read whose request went away before the registry answered', async () => {
    const aborted = new AbortController();
    aborted.abort();
    await expect(
      runner().read(
        check('2026-09-29T12:00:00.000Z', '2026-09-29T11:50:00.000Z'),
        aborted.signal,
      ),
    ).rejects.toThrow();
  });

  it('starts nothing for a request that went away before the update was claimed', async () => {
    const updates = runner();
    const aborted = new AbortController();
    aborted.abort();
    await expect(
      updates.start({ version: '1.1.0' }, aborted.signal),
    ).rejects.toThrow();
    const state = await updates.read(
      check('2026-09-29T12:00:00.000Z', '2026-09-29T11:50:00.000Z'),
    );
    expect(state).toMatchObject({ running: false, last: undefined });
  });

  it('offers nothing to a server that does not run from the installed runtime', async () => {
    const state = await runner(join(home, 'elsewhere')).read(
      check('2026-09-29T12:00:00.000Z', '2026-09-29T11:50:00.000Z'),
    );
    expect(state).toMatchObject({ managed: false, available: false });
    expect(npmViews).toBe(0);
  });
});
