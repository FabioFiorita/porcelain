import { Effect, FileSystem, Stream } from 'effect';
import { ProviderProcessFailedError } from '../errors/provider-process-failed-error.ts';

export const readBoundedText = Effect.fn('Provider.readBoundedText')(function* (
  file: string,
  maxBytes: number,
) {
  const fs = yield* FileSystem.FileSystem;
  const chunks = yield* fs
    .stream(file, { bytesToRead: maxBytes + 1 })
    .pipe(Stream.runCollect);
  const bytes = Buffer.concat(chunks);
  if (bytes.length > maxBytes)
    return yield* Effect.fail(new ProviderProcessFailedError());
  return bytes.toString('utf8');
});
