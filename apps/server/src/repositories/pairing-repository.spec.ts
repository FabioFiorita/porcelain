import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { openDatabase } from '../db/connection.ts';
import { hashSecret, mintCredential } from '../models/credential.ts';
import { PairingRepository } from './pairing-repository.ts';

async function repository(root: string) {
  const database = openDatabase(join(root, 'state'));
  return { database, store: new PairingRepository(database.db) };
}

function grant(now: number, secret: string) {
  return {
    id: crypto.randomUUID(),
    label: 'iPhone',
    secretHash: hashSecret(secret),
    addresses: ['http://127.0.0.1:3000'],
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 900_000).toISOString(),
  };
}

function device(secret: string, now: number) {
  return {
    id: crypto.randomUUID(),
    label: 'iPhone',
    platform: 'iOS 18',
    secretHash: hashSecret(secret),
    createdAt: new Date(now).toISOString(),
  };
}

it('consumes a grant once and refuses every later attempt', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-pairing-'));
  const { database, store } = await repository(root);
  try {
    const now = Date.now();
    const secret = 'secret-value';
    const record = grant(now, secret);
    store.issueGrant(record);

    const first = store.redeem({
      grantId: record.id,
      secret,
      now: new Date(now).toISOString(),
      device: device('first', now),
    });
    expect(first).toMatchObject({ label: 'iPhone', platform: 'iOS 18' });

    // The same link again, and with the right secret: still refused.
    expect(
      store.redeem({
        grantId: record.id,
        secret,
        now: new Date(now + 1).toISOString(),
        device: device('second', now),
      }),
    ).toBeNull();
    expect(store.listDevices()).toHaveLength(1);
  } finally {
    database.close();
    await rm(root, { recursive: true, force: true });
  }
});

it('refuses a wrong secret, an expired grant, a revoked one, and a future one', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-pairing-refuse-'));
  const { database, store } = await repository(root);
  try {
    const now = Date.now();
    const at = new Date(now).toISOString();

    const wrong = grant(now, 'right');
    store.issueGrant(wrong);
    expect(
      store.redeem({
        grantId: wrong.id,
        secret: 'not-right',
        now: at,
        device: device('a', now),
      }),
    ).toBeNull();

    const expired = { ...grant(now, 's'), id: crypto.randomUUID() };
    expired.expiresAt = new Date(now - 1).toISOString();
    store.issueGrant(expired);
    expect(
      store.redeem({
        grantId: expired.id,
        secret: 's',
        now: at,
        device: device('b', now),
      }),
    ).toBeNull();

    const revoked = grant(now, 's');
    store.issueGrant(revoked);
    expect(store.revokeGrant(revoked.id, at)).toBe(true);
    expect(
      store.redeem({
        grantId: revoked.id,
        secret: 's',
        now: at,
        device: device('c', now),
      }),
    ).toBeNull();
    // Revoking it twice is not a second success.
    expect(store.revokeGrant(revoked.id, at)).toBe(false);

    // The clock moved backwards: the grant claims to be created in the future.
    const ahead = grant(now + 60_000, 's');
    store.issueGrant(ahead);
    expect(
      store.redeem({
        grantId: ahead.id,
        secret: 's',
        now: at,
        device: device('d', now),
      }),
    ).toBeNull();

    expect(store.listDevices()).toEqual([]);
    // The wrong-secret grant and the future-dated one are both still pending;
    // only the revoked and expired ones have left the list.
    expect(new Set(store.listGrants(at).map((entry) => entry.id))).toEqual(
      new Set([wrong.id, ahead.id]),
    );
  } finally {
    database.close();
    await rm(root, { recursive: true, force: true });
  }
});

/**
 * Two processes, each opening the database itself, released by a file barrier.
 *
 * Each child runs the real `PairingRepository.redeem`, so the atomicity being
 * proved is production's. An earlier version embedded equivalent SQL in the
 * spec; its mutation only ever mutated that copy, which meant a racy rewrite of
 * the repository would have left both tests green.
 *
 * `mode` selects how the child calls it. `guarded` is the shipped path;
 * `ignores-changes` patches the repository's conditional update to drop its
 * `changes === 1` gate, which is the production behaviour worth mutating — a
 * read-then-write mutation proves nothing here, because WAL snapshot isolation
 * already refuses the second writer's upgrade.
 */
async function raceRedemption(
  root: string,
  mode: 'guarded' | 'ignores-changes',
) {
  const dataDirectory = join(root, 'state');
  const { database, store } = await repository(root);
  const secret = 'race-secret';
  const record = grant(Date.now(), secret);
  store.issueGrant(record);
  database.close();

  const barrier = join(root, 'go');
  const repositoryModule = join(import.meta.dirname, 'pairing-repository.ts');
  const connectionModule = join(import.meta.dirname, '../db/connection.ts');
  const script = (label: string) => `
    import { existsSync } from 'node:fs';
    import { openDatabase } from ${JSON.stringify(connectionModule)};
    import { PairingRepository } from ${JSON.stringify(repositoryModule)};

    const database = openDatabase(${JSON.stringify(dataDirectory)});
    database.db.$client.pragma('busy_timeout = 5000');
    const store = new PairingRepository(database.db);
    ${
      mode === 'ignores-changes'
        ? `// The mutation, applied to the production object: act on the
           // conditional update without checking what it changed.
           const client = database.db.$client;
           const original = client.prepare.bind(client);
           client.prepare = (sql) => {
             const statement = original(sql);
             if (!sql.includes('update "pairing_grants"')) return statement;
             return new Proxy(statement, {
               get(target, property, receiver) {
                 if (property !== 'run') return Reflect.get(target, property, receiver);
                 return (...args) => ({ ...target.run(...args), changes: 1 });
               },
             });
           };`
        : ''
    }
    while (!existsSync(${JSON.stringify(barrier)})) {}
    const now = new Date().toISOString();
    let won = false;
    try {
      won = Boolean(
        store.redeem({
          grantId: ${JSON.stringify(record.id)},
          secret: ${JSON.stringify(secret)},
          now,
          device: {
            id: ${JSON.stringify(label)},
            label: 'x',
            platform: 'y',
            secretHash: 'z',
            createdAt: now,
          },
        }),
      );
    } catch {
      won = false;
    }
    database.close();
    process.stdout.write(won ? 'won' : 'lost');
  `;
  const children = [
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
  ].map(
    (label) =>
      new Promise<string>((resolve) => {
        const child = spawn(process.execPath, [
          '--input-type=module',
          '-e',
          script(label),
        ]);
        let out = '';
        child.stdout.on('data', (chunk: Buffer) => {
          out += chunk.toString();
        });
        child.on('close', () => resolve(out));
      }),
  );
  await new Promise((resolve) => setTimeout(resolve, 500));
  await writeFile(barrier, 'go');
  const outcomes = await Promise.all(children);

  const reopened = openDatabase(dataDirectory);
  const devices = new PairingRepository(reopened.db).listDevices();
  reopened.close();
  return { outcomes, devices };
}

it('lets only one of two racing processes redeem a grant', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-pairing-race-'));
  try {
    const { outcomes, devices } = await raceRedemption(root, 'guarded');
    expect(outcomes.filter((outcome) => outcome === 'won')).toHaveLength(1);
    expect(devices).toHaveLength(1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 30000);

it('fails the same race when the repository ignores its conditional update', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-pairing-race-broken-'));
  try {
    // If this stops producing two devices, the race above has stopped racing
    // and the atomicity it claims is no longer being tested.
    const { devices } = await raceRedemption(root, 'ignores-changes');
    expect(devices.length).toBeGreaterThan(1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 30000);

it('writes only last-seen fields and never revives a revoked device', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-pairing-flush-'));
  const { database, store } = await repository(root);
  try {
    const now = Date.now();
    const at = new Date(now).toISOString();
    const secret = 'secret-value';
    const record = grant(now, secret);
    store.issueGrant(record);
    const credential = mintCredential('pcd');
    const paired = store.redeem({
      grantId: record.id,
      secret,
      now: at,
      device: {
        id: credential.id,
        label: 'iPad',
        platform: 'iPadOS',
        secretHash: hashSecret(credential.secret),
        createdAt: at,
      },
    });
    if (!paired) throw new Error('Expected a device');

    expect(store.revokeDevice(paired.id, at)).toBe(true);
    // A flush that was already in flight when the revocation landed.
    store.recordLastSeen([
      {
        deviceId: paired.id,
        lastSeenAt: new Date(now + 1000).toISOString(),
        lastSeenAddress: '10.0.0.9',
      },
    ]);
    expect(store.listDevices()).toEqual([]);
    const stored = store.allDevices().find((entry) => entry.id === paired.id);
    expect(stored?.revokedAt).toBe(at);
    // The write was ignored entirely rather than partially applied.
    expect(stored?.lastSeenAt).toBe(at);
  } finally {
    database.close();
    await rm(root, { recursive: true, force: true });
  }
});

it('keeps existing rows and both new tables across a reopen', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-pairing-migrate-'));
  const dataDirectory = join(root, 'state');
  try {
    const first = openDatabase(dataDirectory);
    first.db.run(
      "INSERT INTO reviewed_files (worktree_id, path, fingerprint, reviewed_at) VALUES ('w', 'a.ts', 'f', '2026-01-01T00:00:00.000Z')" as never,
    );
    first.close();

    const second = openDatabase(dataDirectory);
    const rows = second.db.all(
      'SELECT worktree_id FROM reviewed_files' as never,
    ) as { worktree_id: string }[];
    expect(rows).toEqual([{ worktree_id: 'w' }]);
    expect(new PairingRepository(second.db).listDevices()).toEqual([]);
    expect(
      new PairingRepository(second.db).listGrants(new Date().toISOString()),
    ).toEqual([]);
    second.close();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

/** A database recorded as migrated through 0002, with a row worth keeping. */
async function databaseAt0002(dataDirectory: string) {
  const { DatabaseSync } = await import('node:sqlite');
  const { createHash } = await import('node:crypto');
  const { readFile } = await import('node:fs/promises');
  const migrations = join(import.meta.dirname, '../../drizzle');
  const applied = [
    ['0000_current-schema.sql', 1788921607579],
    ['0001_light_iceman.sql', 1789345784383],
    ['0002_backfill_comment_authors.sql', 1789347169518],
  ] as const;
  await mkdir(dataDirectory, { recursive: true, mode: 0o700 });
  const database = new DatabaseSync(join(dataDirectory, 'inventory.sqlite'));
  try {
    for (const [name] of applied.slice(0, 2))
      database.exec(await readFile(join(migrations, name), 'utf8'));
    database.exec(
      'CREATE TABLE __drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric);',
    );
    for (const [name, when] of applied) {
      const hash = createHash('sha256')
        .update(await readFile(join(migrations, name), 'utf8'))
        .digest('hex');
      database
        .prepare(
          'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)',
        )
        .run(hash, when);
    }
    database
      .prepare(
        'INSERT INTO reviewed_files (worktree_id, path, fingerprint, reviewed_at) VALUES (?, ?, ?, ?)',
      )
      .run(
        'legacy-worktree',
        'src/a.ts',
        'fingerprint',
        '2026-01-01T00:00:00.000Z',
      );
  } finally {
    database.close();
  }
}

it('rolls 0003 back as a whole when one of its statements fails', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-pairing-rollback-'));
  const dataDirectory = join(root, 'state');
  const { DatabaseSync } = await import('node:sqlite');
  try {
    await databaseAt0002(dataDirectory);
    // 0003 creates `devices`, then `pairing_grants`. A table already holding
    // the second name makes that statement fail after the first has run, which
    // is the interruption this test is about — the earlier version failed the
    // history check before any statement executed and proved nothing.
    const prepared = new DatabaseSync(join(dataDirectory, 'inventory.sqlite'));
    prepared.exec('CREATE TABLE pairing_grants (id TEXT)');
    prepared.close();

    // The failure must be 0003's own statement, not the history check
    // refusing the fixture: otherwise "devices is absent" would prove only
    // that nothing ever ran.
    let failure: unknown;
    try {
      openDatabase(dataDirectory);
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).name).not.toBe('UnsupportedDatabaseVersionError');
    expect((failure as Error).message).toContain('pairing_grants');

    const after = new DatabaseSync(join(dataDirectory, 'inventory.sqlite'));
    try {
      const tables = after
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all()
        .map((row) => (row as { name: string }).name);
      // The first statement's table went with the failed migration.
      expect(tables).not.toContain('devices');
      expect(tables).toContain('pairing_grants');
      // The journal did not advance.
      expect(
        after
          .prepare('SELECT count(*) AS count FROM __drizzle_migrations')
          .get(),
      ).toMatchObject({ count: 3 });
      // And the rows that were already there are untouched.
      expect(after.prepare('SELECT path FROM reviewed_files').all()).toEqual([
        { path: 'src/a.ts' },
      ]);
    } finally {
      after.close();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
