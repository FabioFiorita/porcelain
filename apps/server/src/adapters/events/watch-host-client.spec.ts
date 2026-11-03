import { NodeServices } from '@effect/platform-node';
import { Duration, Effect, Exit, Scope } from 'effect';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import {
  nodeWatchHost,
  watchHostEntry,
  type WatchHostCommand,
} from '../../config/watch-host-settings.ts';
import {
  makeWatchHost,
  WATCHER_RESTARTED,
  type WatchHost,
} from './watch-host-client.ts';

const settled = { timeout: 3000 };
const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function folder(): string {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'pc-watch-host-')));
  directories.push(directory);
  return directory;
}

function helpers(): number[] {
  return execFileSync('ps', ['-A', '-o', 'pid=,ppid=,command='], {
    encoding: 'utf8',
  })
    .split('\n')
    .map((line) => line.trim().split(/\s+/))
    .filter(
      ([, parent, ...command]) =>
        Number(parent) === process.pid &&
        command.join(' ').includes(watchHostEntry()),
    )
    .map(([pid]) => Number(pid));
}

async function withHost(
  work: (host: WatchHost) => Promise<void>,
  command: WatchHostCommand = nodeWatchHost(),
) {
  const scope = Effect.runSync(Scope.make());
  const host = await Effect.runPromise(
    makeWatchHost({
      ...command,
      heartbeat: Duration.millis(100),
      answer: Duration.millis(1000),
    }).pipe(
      Effect.provideService(Scope.Scope, scope),
      Effect.provide(NodeServices.layer),
    ),
  );
  try {
    await work(host);
  } finally {
    await Effect.runPromise(Scope.close(scope, Exit.void));
  }
}

function recorder(seen: string[]) {
  return (failure: string | undefined, events: readonly { path: string }[]) =>
    seen.push(failure ?? events.map((event) => event.path).join(','));
}

it('reports a change in a watched folder and stops its helper on close', async () => {
  const directory = folder();
  const seen: string[] = [];
  await withHost(async (host) => {
    await Effect.runPromise(host.subscribe(directory, [], recorder(seen)));
    writeFileSync(join(directory, 'a.txt'), 'a');
    await expect.poll(() => seen, settled).toEqual([join(directory, 'a.txt')]);
  });
  await expect.poll(helpers, settled).toEqual([]);
});

it('fails to watch a folder that does not exist', async () => {
  const missing = join(folder(), 'missing');
  await withHost(async (host) => {
    const failure = await Effect.runPromise(
      Effect.flip(host.subscribe(missing, [], () => undefined)),
    );
    expect(failure._tag).toBe('WorktreeWatchError');
  });
});

it.each(['SIGSTOP', 'SIGKILL'] as const)(
  'replaces a helper stopped by %s, tells each watch it restarted and keeps reporting changes',
  async (signal) => {
    const directory = folder();
    const seen: string[] = [];
    await withHost(async (host) => {
      await Effect.runPromise(host.subscribe(directory, [], recorder(seen)));
      await expect.poll(() => helpers().length, settled).toBe(1);
      const [stopped] = helpers();
      process.kill(Number(stopped), signal);
      await expect.poll(() => seen, settled).toEqual([WATCHER_RESTARTED]);
      expect(helpers()).toHaveLength(1);
      expect(helpers()).not.toContain(stopped);
      writeFileSync(join(directory, 'after.txt'), 'b');
      await expect
        .poll(() => seen, settled)
        .toEqual([WATCHER_RESTARTED, join(directory, 'after.txt')]);
    });
  },
);

it('fails a watch when its helper dies on every start, after trying once more', async () => {
  const starts = join(folder(), 'starts');
  writeFileSync(starts, '');
  await withHost(
    async (host) => {
      const failure = await Effect.runPromise(
        Effect.flip(host.subscribe(folder(), [], () => undefined)),
      );
      expect(failure._tag).toBe('WorktreeWatchError');
    },
    {
      command: process.execPath,
      args: [
        '-e',
        `require('node:fs').appendFileSync(${JSON.stringify(starts)}, 'started\\n'); process.exit(1)`,
      ],
    },
  );
  expect(readFileSync(starts, 'utf8')).toBe('started\nstarted\n');
});
