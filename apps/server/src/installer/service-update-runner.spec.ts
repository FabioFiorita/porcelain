import { Effect } from 'effect';
import { NodeServices } from '@effect/platform-node';
import { nativeOperation, withSignal } from '@porcelain/effects';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openServiceUpdateRunner } from './service-update-runner.ts';
import type { CommandRunner } from './command-runner.ts';

type Answer = { code: number; stdout: string; stderr: string };

let home: string;
let published: string;
let updaterActive: boolean;
let npmViews: number;
let nativeModulesLoad: Answer;
let commands: string[];
const owned: Effect.Success<ReturnType<typeof openServiceUpdateRunner>>[] = [];

const packageName = '@fabiofiorita/porcelain';
const serviceNode = '/opt/service/bin/node';
const runtimePackage = () =>
  join(
    home,
    '.local/share/porcelain/service/runtime/node_modules',
    packageName,
  );

function downloadInto(prefix: string, version: string) {
  const folder = join(prefix, 'node_modules', packageName);
  mkdirSync(folder, { recursive: true });
  writeFileSync(
    join(folder, 'package.json'),
    JSON.stringify({ name: packageName, version }),
  );
}

const answer = Effect.fn('Test.updateCommand')(
  (command: string, args: readonly string[]) =>
    Effect.sync(() => {
      const ok = (stdout: string): Answer => ({ code: 0, stdout, stderr: '' });
      commands.push(command);
      const target = args.at(-1) ?? '';
      if (command === 'npm' && args[0] === 'install') {
        downloadInto(
          args[args.indexOf('--prefix') + 1] ?? '',
          target.slice(`${packageName}@`.length),
        );
        return ok('');
      }
      if (command === serviceNode) return nativeModulesLoad;
      if (command === 'npm' && args[0] === 'view') {
        npmViews += 1;
        return ok(JSON.stringify(published));
      }
      if (command === 'systemctl')
        return updaterActive
          ? ok('active\n')
          : { code: 3, stdout: 'inactive\n', stderr: '' };
      return { code: 1, stdout: '', stderr: `unexpected ${command}` };
    }),
);

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

const runner = async (
  packageRoot = runtimePackage(),
  command: CommandRunner = answer,
) => {
  const updates = await Effect.runPromise(
    openServiceUpdateRunner({
      homeDirectory: home,
      packageRoot,
      searchPath: '/usr/bin',
      command: {
        timeoutMs: 1000,
        maxBytes: 1024,
        processGroup: { lingerMs: 10, cleanupMs: 10, pollMs: 1 },
      },
      runner: command,
      nodeExecutable: serviceNode,
    }).pipe(Effect.provide(NodeServices.layer)),
  );
  owned.push(updates);
  return updates;
};
const check = (now: string, staleBefore: string) => ({ now, staleBefore });

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'porcelain-service-updates-'));
  published = '1.1.0';
  updaterActive = false;
  npmViews = 0;
  nativeModulesLoad = { code: 0, stdout: '', stderr: '' };
  commands = [];
  install('1.0.0');
});

afterEach(async () => {
  await Promise.all(
    owned.splice(0).map((updates) => Effect.runPromise(updates.close())),
  );
  rmSync(home, { recursive: true, force: true });
});

describe('the installed service update runner', () => {
  it('owns accepted preparation after caller disconnect and waits for native cleanup before recording shutdown', async () => {
    const started = Promise.withResolvers<AbortSignal>();
    const aborted = Promise.withResolvers<void>();
    const cleanup = Promise.withResolvers<Answer>();
    const updates = await runner(runtimePackage(), (command, args) => {
      if (command !== 'npm' || args[0] !== 'install')
        return answer(command, args);
      return nativeOperation((signal) => {
        signal.addEventListener('abort', () => aborted.resolve(), {
          once: true,
        });
        started.resolve(signal);
        return cleanup.promise;
      });
    });
    const caller = new AbortController();
    await Effect.runPromise(
      withSignal(updates.start({ version: '1.1.0' }), caller.signal),
    );
    const preparation = await started.promise;
    caller.abort();
    expect(preparation.aborted).toBe(false);
    const closing = Effect.runPromise(updates.close());
    await aborted.promise;
    expect(
      (
        await Effect.runPromise(
          updates.read(
            check('2026-09-29T12:00:00.000Z', '2026-09-29T11:50:00.000Z'),
          ),
        )
      ).running,
    ).toBe(true);
    cleanup.resolve({ code: 1, stdout: '', stderr: 'Stopped' });
    await closing;
    expect(
      await Effect.runPromise(
        updates.read(
          check('2026-09-29T12:00:00.000Z', '2026-09-29T11:50:00.000Z'),
        ),
      ),
    ).toMatchObject({
      running: false,
      last: {
        from: '1.0.0',
        target: '1.1.0',
        stage: 'failed',
        reason: 'The server stopped before the update was handed off.',
      },
    });
    expect(commands).not.toContain('systemd-run');
  });

  it('offers the newer published version to the installed service', async () => {
    expect(
      await Effect.runPromise(
        (await runner()).read(
          check('2026-09-29T12:00:00.000Z', '2026-09-29T11:50:00.000Z'),
        ),
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
    const updates = await runner();
    await Effect.runPromise(
      updates.read(
        check('2026-09-29T12:00:00.000Z', '2026-09-29T11:50:00.000Z'),
      ),
    );
    published = '1.2.0';
    const fresh = await Effect.runPromise(
      updates.read(
        check('2026-09-29T12:05:00.000Z', '2026-09-29T11:55:00.000Z'),
      ),
    );
    expect(fresh.latest).toBe('1.1.0');
    expect(npmViews).toBe(1);
    const stale = await Effect.runPromise(
      updates.read(
        check('2026-09-29T12:11:00.000Z', '2026-09-29T12:01:00.000Z'),
      ),
    );
    expect(stale.latest).toBe('1.2.0');
    expect(npmViews).toBe(2);
  });

  it('does not ask the registry while an update runs', async () => {
    updaterActive = true;
    const state = await Effect.runPromise(
      (await runner()).read(
        check('2026-09-29T12:00:00.000Z', '2026-09-29T11:50:00.000Z'),
      ),
    );
    expect(state.running).toBe(true);
    expect(npmViews).toBe(0);
  });

  it('stops a read whose request went away before the registry answered', async () => {
    const aborted = new AbortController();
    aborted.abort();
    await expect(
      Effect.runPromise(
        withSignal(
          (await runner()).read(
            check('2026-09-29T12:00:00.000Z', '2026-09-29T11:50:00.000Z'),
          ),
          aborted.signal,
        ),
      ),
    ).rejects.toThrow();
  });

  it('starts nothing for a request that went away before the update was claimed', async () => {
    const updates = await runner();
    const aborted = new AbortController();
    aborted.abort();
    await expect(
      Effect.runPromise(
        withSignal(updates.start({ version: '1.1.0' }), aborted.signal),
      ),
    ).rejects.toThrow();
    const state = await Effect.runPromise(
      updates.read(
        check('2026-09-29T12:00:00.000Z', '2026-09-29T11:50:00.000Z'),
      ),
    );
    expect(state).toMatchObject({ running: false, last: undefined });
  });

  it('offers nothing to a server that does not run from the installed runtime', async () => {
    const state = await Effect.runPromise(
      (await runner(join(home, 'elsewhere'))).read(
        check('2026-09-29T12:00:00.000Z', '2026-09-29T11:50:00.000Z'),
      ),
    );
    expect(state).toMatchObject({ managed: false, available: false });
    expect(npmViews).toBe(0);
  });

  it('fails the update with the reason and hands nothing over when the downloaded runtime cannot load its native modules', async () => {
    nativeModulesLoad = {
      code: 1,
      stdout: '',
      stderr: 'Could not locate the bindings file.',
    };
    const updates = await runner();
    await Effect.runPromise(updates.start({ version: '1.1.0' }));
    await expect
      .poll(
        async () =>
          (
            await Effect.runPromise(
              updates.read(
                check('2026-09-29T12:00:00.000Z', '2026-09-29T11:50:00.000Z'),
              ),
            )
          ).last,
      )
      .toEqual({
        from: '1.0.0',
        target: '1.1.0',
        stage: 'failed',
        reason:
          'The persistent runtime cannot load its native modules (node:sqlite, @parcel/watcher): Could not locate the bindings file.',
      });
    expect(commands).not.toContain('systemd-run');
  });
});
