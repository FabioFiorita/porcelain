import { Effect } from 'effect';
import { NodeServices } from '@effect/platform-node';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { backupDatabase, pruneDatabaseBackups } from './database-backup.ts';

let root: string;
const prune = (folder = root) =>
  Effect.runPromise(
    pruneDatabaseBackups(folder).pipe(Effect.provide(NodeServices.layer)),
  );
const name = (day: number) =>
  `2026-10-${String(day).padStart(2, '0')}T12-00-00.000Z-1.0.0-id`;
function backups(count: number) {
  for (let day = count; day > 0; day--) {
    const directory = join(root, name(day));
    mkdirSync(directory);
    writeFileSync(join(directory, 'inventory.sqlite'), `database ${day}`);
  }
}
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'porcelain-backups-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

it('keeps only the newest three complete backups, regardless of directory enumeration order', async () => {
  backups(5);
  writeFileSync(join(root, 'README'), 'retained');
  await prune();
  expect(readdirSync(root).sort()).toEqual(
    [name(3), name(4), name(5), 'README'].sort(),
  );
  expect(
    [3, 4, 5].map((day) =>
      readFileSync(join(root, name(day), 'inventory.sqlite'), 'utf8'),
    ),
  ).toEqual(['database 3', 'database 4', 'database 5']);
});

it.each([0, 1, 3])(
  'retains all %i backups when within the limit',
  async (count) => {
    backups(count);
    await prune();
    expect(readdirSync(root).sort()).toEqual(
      Array.from({ length: count }, (_, i) => name(i + 1)),
    );
  },
);

it('leaves a missing backup folder absent', async () => {
  const missing = join(root, 'missing');
  await prune(missing);
  expect(existsSync(missing)).toBe(false);
});

it('reports an unreadable backup directory instead of claiming cleanup succeeded', async () => {
  const file = join(root, 'file');
  writeFileSync(file, 'not a directory');
  await expect(prune(file)).rejects.toThrow();
  expect(readFileSync(file, 'utf8')).toBe('not a directory');
});

it('keeps the newest three completed backups when newer unfinished copies exist', async () => {
  backups(5);
  for (const day of [6, 7, 8]) {
    mkdirSync(join(root, `${name(day)}.partial`));
  }
  await prune();
  expect(
    readdirSync(root)
      .filter((entry) => !entry.endsWith('.partial'))
      .sort(),
  ).toEqual([name(3), name(4), name(5)]);
  expect(
    [3, 4, 5].map((day) =>
      readFileSync(join(root, name(day), 'inventory.sqlite'), 'utf8'),
    ),
  ).toEqual(['database 3', 'database 4', 'database 5']);
});

const backup = (source: string, destination = join(root, 'completed')) =>
  Effect.runPromise(
    backupDatabase(source, destination).pipe(
      Effect.provide(NodeServices.layer),
    ),
  );
function sourceDatabase(label: string) {
  const source = join(root, label);
  mkdirSync(source);
  writeFileSync(join(source, 'inventory.sqlite'), `${label} database`);
  writeFileSync(join(source, 'inventory.sqlite-wal'), `${label} wal`);
  return source;
}

it('publishes every available database file together and removes the staging folder', async () => {
  const source = sourceDatabase('source');
  await backup(source);
  expect(readdirSync(root).sort()).toEqual(['completed', 'source']);
  expect(readdirSync(join(root, 'completed')).sort()).toEqual([
    'inventory.sqlite',
    'inventory.sqlite-wal',
  ]);
  expect(readFileSync(join(root, 'completed/inventory.sqlite'), 'utf8')).toBe(
    'source database',
  );
  expect(
    readFileSync(join(root, 'completed/inventory.sqlite-wal'), 'utf8'),
  ).toBe('source wal');
});

it('publishes a complete empty backup when the database has not been created yet', async () => {
  await backup(join(root, 'absent'));
  expect(readdirSync(root)).toEqual(['completed']);
  expect(readdirSync(join(root, 'completed'))).toEqual([]);
});

it('reports a failed database copy without publishing or retaining a partial backup', async () => {
  const source = sourceDatabase('source');
  rmSync(join(source, 'inventory.sqlite-wal'));
  mkdirSync(join(source, 'inventory.sqlite-wal'));
  await expect(backup(source)).rejects.toThrow();
  expect(readdirSync(root)).toEqual(['source']);
  expect(readFileSync(join(source, 'inventory.sqlite'), 'utf8')).toBe(
    'source database',
  );
});

it('refuses to replace a populated destination and cleans up its own unpublished copy', async () => {
  const source = sourceDatabase('source');
  mkdirSync(join(root, 'completed'));
  writeFileSync(join(root, 'completed/foreign'), 'owned elsewhere');
  await expect(backup(source)).rejects.toThrow();
  expect(readdirSync(root).sort()).toEqual(['completed', 'source']);
  expect(readdirSync(join(root, 'completed'))).toEqual(['foreign']);
  expect(readFileSync(join(root, 'completed/foreign'), 'utf8')).toBe(
    'owned elsewhere',
  );
});

it('never mixes files when concurrent copies try to publish the same destination', async () => {
  const first = sourceDatabase('first');
  const second = sourceDatabase('second');
  const outcomes = await Promise.allSettled([backup(first), backup(second)]);
  expect(outcomes.map((outcome) => outcome.status).sort()).toEqual([
    'fulfilled',
    'rejected',
  ]);
  const winner = outcomes[0]?.status === 'fulfilled' ? 'first' : 'second';
  expect(readFileSync(join(root, 'completed/inventory.sqlite'), 'utf8')).toBe(
    `${winner} database`,
  );
  expect(
    readFileSync(join(root, 'completed/inventory.sqlite-wal'), 'utf8'),
  ).toBe(`${winner} wal`);
  expect(readdirSync(root).sort()).toEqual(['completed', 'first', 'second']);
});
