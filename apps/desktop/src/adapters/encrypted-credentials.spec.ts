import { NodeFileSystem } from '@effect/platform-node';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { expect, it } from '@effect/vitest';
import { Effect, FileSystem } from 'effect';
import { join } from 'node:path';
import {
  CredentialStorageError,
  openEncryptedCredentials,
} from './encrypted-credentials.ts';

const fixture = Effect.gen(function* () {
  const profile = yield* (yield* FileSystem.FileSystem).makeTempDirectoryScoped(
    {
      prefix: 'porcelain-desktop-persistence-',
    },
  );
  const encryptedValues = new Map<string, string>();
  const staleKeys = new Set<string>();
  const encryption = {
    available: () => Effect.succeed(true),
    encrypt: (value: string) =>
      Effect.sync(() => {
        const encrypted = Buffer.from(`encrypted:${encryptedValues.size}`);
        encryptedValues.set(encrypted.toString('hex'), value);
        return encrypted;
      }),
    decrypt: (value: Buffer) =>
      Effect.suspend(() => {
        const decrypted = encryptedValues.get(value.toString('hex'));
        return decrypted === undefined
          ? Effect.fail(
              new CredentialStorageError({ message: 'Invalid ciphertext' }),
            )
          : Effect.succeed({
              value: decrypted,
              reEncrypt: staleKeys.has(value.toString('hex')),
            });
      }),
  };
  const credentials = yield* openEncryptedCredentials(profile, encryption);
  return {
    profile,
    encryption,
    credentials,
    staleKeys,
    file: join(profile, 'credentials.enc'),
  };
});

it.effect('reports nothing saved before any credential value is stored', () =>
  Effect.gen(function* () {
    const { credentials } = yield* fixture;
    expect(yield* credentials.read()).toEqual({ status: 'empty' });
  }).pipe(Effect.scoped, Effect.provide(NodeFileSystem.layer)),
);

it.effect(
  'encrypts opaque credentials with owner permissions and restores them through a new instance',
  () =>
    Effect.gen(function* () {
      const { credentials, profile, encryption, file } = yield* fixture;
      const value = '[{"name":"Mac 💻","credential":"test-only-bearer"}]';
      yield* credentials.write(value);
      const reopened = yield* openEncryptedCredentials(profile, encryption);
      expect(yield* reopened.read()).toEqual({ status: 'saved', value });
      expect(
        Buffer.from(yield* Effect.tryPromise(() => readFile(file))).includes(
          Buffer.from('test-only-bearer'),
        ),
      ).toBe(false);
      expect((yield* Effect.tryPromise(() => stat(file))).mode & 0o777).toBe(
        0o600,
      );
      expect(yield* Effect.tryPromise(() => readdir(profile))).toEqual([
        'credentials.enc',
      ]);
    }).pipe(Effect.scoped, Effect.provide(NodeFileSystem.layer)),
);

it.effect('keeps an empty string distinct from no stored value', () =>
  Effect.gen(function* () {
    const { credentials } = yield* fixture;
    yield* credentials.write('');
    expect(yield* credentials.read()).toEqual({ status: 'saved', value: '' });
  }).pipe(Effect.scoped, Effect.provide(NodeFileSystem.layer)),
);

it.effect('rejects unavailable encryption without creating a file', () =>
  Effect.gen(function* () {
    const { profile, encryption } = yield* fixture;
    const credentials = yield* openEncryptedCredentials(profile, {
      ...encryption,
      available: () => Effect.succeed(false),
    });
    expect(
      yield* Effect.flip(credentials.write('test-only-secret')),
    ).toMatchObject({ message: 'Encrypted credential storage is unavailable' });
    expect(yield* Effect.tryPromise(() => readdir(profile))).toEqual([]);
  }).pipe(Effect.scoped, Effect.provide(NodeFileSystem.layer)),
);

it.effect(
  'preserves previous ciphertext when encryption fails and accepts a later write',
  () =>
    Effect.gen(function* () {
      const { profile, encryption, file } = yield* fixture;
      let failing = false;
      const credentials = yield* openEncryptedCredentials(profile, {
        ...encryption,
        encrypt: (value) =>
          failing
            ? Effect.fail(
                new CredentialStorageError({ message: 'Encryption failed' }),
              )
            : encryption.encrypt(value),
      });
      yield* credentials.write('first');
      const first = yield* Effect.tryPromise(() => readFile(file));
      failing = true;
      expect(yield* Effect.flip(credentials.write('second'))).toMatchObject({
        message: 'Encryption failed',
      });
      expect(yield* Effect.tryPromise(() => readFile(file))).toEqual(first);
      failing = false;
      yield* credentials.write('third');
      expect(yield* credentials.read()).toEqual({
        status: 'saved',
        value: 'third',
      });
    }).pipe(Effect.scoped, Effect.provide(NodeFileSystem.layer)),
);

it.effect('serializes writes, reads and clear in request order', () =>
  Effect.gen(function* () {
    const { credentials, profile } = yield* fixture;
    const [, , read] = yield* Effect.all(
      [
        credentials.write('first'),
        credentials.write('second'),
        credentials.read(),
        credentials.clear(),
      ],
      { concurrency: 'unbounded' },
    );
    expect(read).toEqual({ status: 'saved', value: 'second' });
    expect(yield* credentials.read()).toEqual({ status: 'empty' });
    expect(yield* Effect.tryPromise(() => readdir(profile))).toEqual([]);
  }).pipe(Effect.scoped, Effect.provide(NodeFileSystem.layer)),
);

it.effect(
  'reports unreadable ciphertext without overwriting it and allows a write after clear',
  () =>
    Effect.gen(function* () {
      const { credentials, file } = yield* fixture;
      yield* Effect.tryPromise(() => writeFile(file, 'damaged'));
      expect(yield* credentials.read()).toEqual({
        status: 'unreadable',
        message: 'The saved credentials could not be read: Invalid ciphertext',
      });
      expect(yield* Effect.flip(credentials.write('[]'))).toMatchObject({
        message:
          'The saved credentials could not be read, so they are kept unchanged',
      });
      expect(yield* Effect.tryPromise(() => readFile(file, 'utf8'))).toBe(
        'damaged',
      );
      yield* credentials.clear();
      yield* credentials.write('fresh');
      expect(yield* credentials.read()).toEqual({
        status: 'saved',
        value: 'fresh',
      });
    }).pipe(Effect.scoped, Effect.provide(NodeFileSystem.layer)),
);

it.effect('re-encrypts stale ciphertext and restores the same value', () =>
  Effect.gen(function* () {
    const { credentials, file, staleKeys } = yield* fixture;
    yield* credentials.write('stale key');
    const stale = Buffer.from(yield* Effect.tryPromise(() => readFile(file)));
    staleKeys.add(stale.toString('hex'));
    expect(yield* credentials.read()).toEqual({
      status: 'saved',
      value: 'stale key',
    });
    expect(yield* Effect.tryPromise(() => readFile(file))).not.toEqual(stale);
    expect(yield* credentials.read()).toEqual({
      status: 'saved',
      value: 'stale key',
    });
  }).pipe(Effect.scoped, Effect.provide(NodeFileSystem.layer)),
);

it.effect(
  'returns the value when re-encryption fails and preserves its ciphertext',
  () =>
    Effect.gen(function* () {
      const { credentials, file, staleKeys, profile, encryption } =
        yield* fixture;
      yield* credentials.write('stale key');
      const stale = Buffer.from(yield* Effect.tryPromise(() => readFile(file)));
      staleKeys.add(stale.toString('hex'));
      const reopened = yield* openEncryptedCredentials(profile, {
        ...encryption,
        encrypt: () =>
          Effect.fail(
            new CredentialStorageError({ message: 'Encryption failed' }),
          ),
      });
      expect(yield* reopened.read()).toEqual({
        status: 'saved',
        value: 'stale key',
      });
      expect(yield* Effect.tryPromise(() => readFile(file))).toEqual(stale);
    }).pipe(Effect.scoped, Effect.provide(NodeFileSystem.layer)),
);

it.effect('clears saved credentials even when encryption is unavailable', () =>
  Effect.gen(function* () {
    const { credentials, profile, encryption } = yield* fixture;
    yield* credentials.write('test-only-secret');
    const reopened = yield* openEncryptedCredentials(profile, {
      ...encryption,
      available: () => Effect.succeed(false),
    });
    expect(yield* reopened.read()).toEqual({
      status: 'unreadable',
      message: 'Encrypted credential storage is unavailable',
    });
    yield* reopened.clear();
    yield* reopened.clear();
    expect(yield* reopened.read()).toEqual({ status: 'empty' });
  }).pipe(Effect.scoped, Effect.provide(NodeFileSystem.layer)),
);
