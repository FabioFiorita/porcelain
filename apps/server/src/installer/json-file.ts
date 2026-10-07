import { Effect, FileSystem, Path, Schema, Result } from 'effect';
import type { PlatformError } from 'effect/PlatformError';
import { randomUUID } from 'node:crypto';

type JsonFile<T> =
  | { kind: 'missing' }
  | { kind: 'invalid' }
  | { kind: 'value'; value: T };

export const exists = Effect.fn('Installer.exists')(function* (path: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.exists(path);
});

export const readJsonFile = Effect.fn('Installer.readJsonFile')(function* <T>(
  path: string,
  schema: Schema.Codec<T>,
): Effect.fn.Return<JsonFile<T>, PlatformError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs.readFileString(path).pipe(
    Effect.map((text) => ({ kind: 'text' as const, text })),
    Effect.catch((error) =>
      error.reason._tag === 'NotFound'
        ? Effect.succeed({ kind: 'missing' as const })
        : Effect.fail(error),
    ),
  );
  if (text.kind === 'missing') return { kind: 'missing' };
  const result = Schema.decodeUnknownResult(Schema.fromJsonString(schema))(
    text.text,
  );
  return Result.isSuccess(result)
    ? { kind: 'value', value: result.success }
    : { kind: 'invalid' };
});

export const writeJsonFile = Effect.fn('Installer.writeJsonFile')(function* (
  path: string,
  value: unknown,
) {
  const fs = yield* FileSystem.FileSystem;
  const pathApi = yield* Path.Path;
  yield* fs.makeDirectory(pathApi.dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  yield* fs.writeFileString(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    mode: 0o600,
  });
  yield* fs
    .rename(temporary, path)
    .pipe(
      Effect.ensuring(fs.remove(temporary, { force: true }).pipe(Effect.orDie)),
    );
});
