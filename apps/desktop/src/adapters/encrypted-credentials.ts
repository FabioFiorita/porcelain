import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { Data, Effect, FileSystem, Semaphore } from 'effect';
import type { DesktopCredentials } from '@porcelain/contracts/desktop';

export class CredentialStorageError extends Data.TaggedError(
  'CredentialStorageError',
)<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

type Encryption = {
  available: () => Effect.Effect<boolean, CredentialStorageError>;
  encrypt: (value: string) => Effect.Effect<Buffer, CredentialStorageError>;
  decrypt: (
    value: Buffer,
  ) => Effect.Effect<
    { value: string; reEncrypt: boolean },
    CredentialStorageError
  >;
};

type Saved =
  | Exclude<DesktopCredentials, { status: 'saved' }>
  | { status: 'saved'; value: string; reEncrypt: boolean };

function failure(error: unknown): string {
  return `The saved credentials could not be read: ${error instanceof Error ? error.message : 'unknown failure'}`;
}

export const openEncryptedCredentials = Effect.fn('openEncryptedCredentials')(
  function* (profile: string, encryption: Encryption) {
    const fs = yield* FileSystem.FileSystem;
    const semaphore = yield* Semaphore.make(1);
    const serialized = semaphore.withPermit.bind(semaphore);
    const destination = join(profile, 'credentials.enc');
    const store = Effect.fn('EncryptedCredentials.store')(function* (
      value: string,
    ) {
      const encrypted = yield* encryption.encrypt(value);
      yield* fs.makeDirectory(profile, { recursive: true, mode: 0o700 });
      const temporary = `${destination}.${randomUUID()}.tmp`;
      yield* fs
        .writeFile(temporary, encrypted, { flag: 'wx', mode: 0o600 })
        .pipe(
          Effect.andThen(fs.rename(temporary, destination)),
          Effect.ensuring(
            fs.remove(temporary, { force: true }).pipe(Effect.orDie),
          ),
        );
    });
    const saved = Effect.fn('EncryptedCredentials.saved')(
      function* (): Effect.fn.Return<Saved, CredentialStorageError> {
        const encrypted = yield* fs.readFile(destination).pipe(
          Effect.map((bytes) => ({ status: 'bytes' as const, bytes })),
          Effect.catch((error) =>
            Effect.succeed<Saved>(
              error.reason._tag === 'NotFound'
                ? { status: 'empty' }
                : { status: 'unreadable', message: failure(error) },
            ),
          ),
        );
        if (encrypted.status !== 'bytes') return encrypted;
        if (!(yield* encryption.available()))
          return {
            status: 'unreadable',
            message: 'Encrypted credential storage is unavailable',
          };
        return yield* encryption.decrypt(Buffer.from(encrypted.bytes)).pipe(
          Effect.map((decrypted): Saved => ({ status: 'saved', ...decrypted })),
          Effect.catch((error) =>
            Effect.succeed<Saved>({
              status: 'unreadable',
              message: failure(error),
            }),
          ),
        );
      },
    );
    const read = Effect.fn('EncryptedCredentials.read')(
      function* (): Effect.fn.Return<
        DesktopCredentials,
        CredentialStorageError
      > {
        const value = yield* saved();
        if (value.status !== 'saved') return value;
        if (value.reEncrypt) yield* store(value.value).pipe(Effect.ignore);
        return { status: 'saved', value: value.value };
      },
      serialized,
      Effect.uninterruptible,
    );
    const write = Effect.fn('EncryptedCredentials.write')(
      function* (value: string) {
        if (!(yield* encryption.available()))
          return yield* Effect.fail(
            new CredentialStorageError({
              message: 'Encrypted credential storage is unavailable',
            }),
          );
        if ((yield* saved()).status === 'unreadable')
          return yield* Effect.fail(
            new CredentialStorageError({
              message:
                'The saved credentials could not be read, so they are kept unchanged',
            }),
          );
        yield* store(value);
      },
      serialized,
      Effect.uninterruptible,
    );
    const clear = Effect.fn('EncryptedCredentials.clear')(
      () => fs.remove(destination, { force: true }),
      serialized,
      Effect.uninterruptible,
    );
    yield* Effect.addFinalizer(() => serialized(Effect.void));
    return { read, write, clear };
  },
);
