import { NodeServices } from '@effect/platform-node';
import { Effect, FileSystem } from 'effect';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import {
  backupDatabase,
  pruneDatabaseBackups,
  restoreDatabase,
} from './database-backup.ts';

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
  expect(readdirSync(root).sort()).toEqual([name(3), name(4), name(5)]);
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

function sqliteSnapshot(directory: string, value: string) {
  const source = `${directory}-writer`;
  mkdirSync(source);
  mkdirSync(directory);
  const db = new DatabaseSync(join(source, 'inventory.sqlite'));
  try {
    db.exec('PRAGMA journal_mode = WAL; CREATE TABLE saved(value TEXT)');
    db.prepare('INSERT INTO saved VALUES (?)').run(value);
    for (const file of readdirSync(source))
      copyFileSync(join(source, file), join(directory, file));
  } finally {
    db.close();
    rmSync(source, { recursive: true });
  }
}

function checkpointedSnapshot(directory: string, value: string) {
  mkdirSync(directory);
  const db = new DatabaseSync(join(directory, 'inventory.sqlite'));
  try {
    db.exec('CREATE TABLE saved(value TEXT)');
    db.prepare('INSERT INTO saved VALUES (?)').run(value);
  } finally {
    db.close();
  }
}

function savedValue(directory: string) {
  const db = new DatabaseSync(join(directory, 'inventory.sqlite'), {
    readOnly: true,
  });
  try {
    return db.prepare('SELECT value FROM saved').get()?.value;
  } finally {
    db.close();
  }
}

function snapshotBytes(directory: string) {
  return Object.fromEntries(
    readdirSync(directory)
      .sort()
      .map((file) => [
        file,
        createHash('sha256')
          .update(readFileSync(join(directory, file)))
          .digest('hex'),
      ]),
  );
}

const restore = (
  data: string,
  source: string,
  copyFailure = false,
  renameFailure?: { direction: 'from' | 'to'; file: string },
) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      let failed = false;
      return yield* restoreDatabase(data, source).pipe(
        Effect.provideService(FileSystem.FileSystem, {
          ...fs,
          copyFile: (from, to) =>
            copyFailure && from.endsWith('-wal')
              ? fs.copyFile(join(root, 'missing-copy-source'), to)
              : fs.copyFile(from, to),
          rename: (from, to) => {
            if (
              !failed &&
              renameFailure !== undefined &&
              (renameFailure.direction === 'from' ? from : to) ===
                join(data, renameFailure.file)
            ) {
              failed = true;
              return fs.rename(join(root, 'missing-rename-source'), to);
            }
            return fs.rename(from, to);
          },
        }),
      );
    }).pipe(Effect.provide(NodeServices.layer)),
  );

it.each([
  'missing',
  'not-directory',
  'unreadable-directory',
  'unreadable',
  'corrupt',
  'zero-byte',
  'copy-failure',
  'orphan-sidecar',
] as const)(
  '%s backup preserves current database and sidecars on repeated restore attempts',
  async (failure) => {
    const data = join(root, 'current');
    const source = join(root, 'saved');
    sqliteSnapshot(data, 'keep me');
    if (failure === 'not-directory') writeFileSync(source, 'not a directory');
    else if (failure !== 'missing') {
      sqliteSnapshot(source, 'restore me');
      if (failure === 'unreadable-directory') chmodSync(source, 0);
      if (failure === 'unreadable')
        chmodSync(join(source, 'inventory.sqlite-wal'), 0);
      if (failure === 'corrupt') {
        writeFileSync(join(source, 'inventory.sqlite'), 'corrupt database');
        rmSync(join(source, 'inventory.sqlite-wal'));
        rmSync(join(source, 'inventory.sqlite-shm'));
      }
      if (failure === 'zero-byte') {
        rmSync(source, { recursive: true });
        checkpointedSnapshot(source, 'backup before truncation');
        writeFileSync(join(source, 'inventory.sqlite'), '');
      }
      if (failure === 'orphan-sidecar')
        rmSync(join(source, 'inventory.sqlite'));
    }
    const current = snapshotBytes(data);
    try {
      await expect(
        restore(data, source, failure === 'copy-failure'),
      ).rejects.toThrow('Could not prepare database backup');
      await expect(
        restore(data, source, failure === 'copy-failure'),
      ).rejects.toThrow('Could not prepare database backup');
      expect(snapshotBytes(data)).toEqual(current);
      expect(readdirSync(root).sort()).toEqual(
        failure === 'missing' ? ['current'] : ['current', 'saved'],
      );
      expect(savedValue(data)).toBe('keep me');
    } finally {
      if (failure === 'unreadable-directory') chmodSync(source, 0o700);
      if (failure === 'unreadable')
        chmodSync(join(source, 'inventory.sqlite-wal'), 0o600);
    }
  },
);

it.each([
  ...['inventory.sqlite', 'inventory.sqlite-wal', 'inventory.sqlite-shm'].map(
    (file) => ({ direction: 'from' as const, file, current: 'wal' as const }),
  ),
  ...(['wal', 'checkpointed', 'empty'] as const).flatMap((current) =>
    ['inventory.sqlite', 'inventory.sqlite-wal', 'inventory.sqlite-shm'].map(
      (file) => ({ direction: 'to' as const, file, current }),
    ),
  ),
])(
  'failed $direction rename of $file with $current current data preserves every byte and permits retry',
  async ({ direction, file, current: state }) => {
    const data = join(root, 'current');
    const source = join(root, 'saved');
    if (state === 'wal') sqliteSnapshot(data, 'keep me');
    else if (state === 'checkpointed') checkpointedSnapshot(data, 'keep me');
    else mkdirSync(data);
    sqliteSnapshot(source, 'restore me');
    const current = snapshotBytes(data);
    const original = snapshotBytes(source);
    await expect(
      restore(data, source, false, { direction, file }),
    ).rejects.toThrow();
    expect(snapshotBytes(data)).toEqual(current);
    expect(snapshotBytes(source)).toEqual(original);
    await expect(
      restore(data, source, false, { direction, file }),
    ).rejects.toThrow();
    expect(snapshotBytes(data)).toEqual(current);
    expect(snapshotBytes(source)).toEqual(original);
    if (state !== 'empty') expect(savedValue(data)).toBe('keep me');
    await restore(data, source);
    expect(savedValue(data)).toBe('restore me');
    expect(snapshotBytes(source)).toEqual(original);
  },
);

it('failed rename rollback retains displaced originals after a second filesystem error', async () => {
  const data = join(root, 'current');
  const source = join(root, 'saved');
  sqliteSnapshot(data, 'keep me');
  sqliteSnapshot(source, 'restore me');
  const current = snapshotBytes(data);
  const original = snapshotBytes(source);
  let displacedMain: string | undefined;
  let promotionFailed = false;
  await expect(
    Effect.runPromise(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* restoreDatabase(data, source).pipe(
          Effect.provideService(FileSystem.FileSystem, {
            ...fs,
            rename: (from, to) => {
              if (from === join(data, 'inventory.sqlite')) displacedMain = to;
              if (
                from === displacedMain ||
                (!promotionFailed && to === join(data, 'inventory.sqlite-wal'))
              ) {
                promotionFailed = true;
                return fs.rename(join(root, 'missing-rename-source'), to);
              }
              return fs.rename(from, to);
            },
          }),
        );
      }).pipe(Effect.provide(NodeServices.layer)),
    ),
  ).rejects.toThrow('Original database files remain');
  const retained = readdirSync(data).find((file) =>
    file.startsWith('.restore-previous-'),
  );
  expect(retained).toBeDefined();
  expect(snapshotBytes(join(data, retained ?? 'missing-originals'))).toEqual(
    current,
  );
  expect(snapshotBytes(source)).toEqual(original);
});

it('restores committed WAL data repeatedly without changing the backup', async () => {
  const data = join(root, 'current');
  const source = join(root, 'saved');
  sqliteSnapshot(data, 'newer');
  sqliteSnapshot(source, 'restore me');
  const original = snapshotBytes(source);
  await restore(data, source);
  expect(savedValue(data)).toBe('restore me');
  await restore(data, source);
  expect(savedValue(data)).toBe('restore me');
  expect(snapshotBytes(source)).toEqual(original);
  expect(readdirSync(root).sort()).toEqual(['current', 'saved']);
});

it('removes obsolete sidecars when restoring a checkpointed database', async () => {
  const data = join(root, 'current');
  const source = join(root, 'saved');
  sqliteSnapshot(data, 'newer');
  mkdirSync(source);
  const db = new DatabaseSync(join(source, 'inventory.sqlite'));
  db.exec(
    "CREATE TABLE saved(value TEXT); INSERT INTO saved VALUES ('checkpointed')",
  );
  db.close();
  await restore(data, source);
  expect(readdirSync(data)).toEqual(['inventory.sqlite']);
  expect(savedValue(data)).toBe('checkpointed');
});

it('restores an intentionally empty preinstall snapshot to empty repeatedly', async () => {
  const data = join(root, 'current');
  const source = join(root, 'saved');
  sqliteSnapshot(data, 'newer');
  mkdirSync(source);
  await restore(data, source);
  await restore(data, source);
  expect(readdirSync(data)).toEqual([]);
  expect(readdirSync(source)).toEqual([]);
});
