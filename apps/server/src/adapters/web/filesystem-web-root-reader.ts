import { Effect, FileSystem, Layer, Path, Stream } from 'effect';
import { lstat } from 'node:fs/promises';
import {
  WebRootReader,
  type WebRootPath,
  type WebRootFile,
} from '../../ports/web-root-reader.ts';
import { syscall } from '../files/guarded-filesystem-syscalls.ts';

export const filesystemWebRootReaderLayer = (root: string | undefined) =>
  Layer.effect(
    WebRootReader,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const pathApi = yield* Path.Path;
      const pathIsWithin = (parent: string, candidate: string) => {
        const child = pathApi.relative(parent, candidate);
        return (
          child === '' ||
          (child !== '..' &&
            !child.startsWith(`..${pathApi.sep}`) &&
            !pathApi.isAbsolute(child))
        );
      };
      const inside = (path: string) => {
        if (root === undefined) return undefined;
        const absoluteRoot = pathApi.resolve(root);
        const candidate = pathApi.resolve(absoluteRoot, path);
        return pathIsWithin(absoluteRoot, candidate) ? candidate : undefined;
      };
      return {
        find: Effect.fn('FilesystemWebRootReader.find')(function* (
          input: WebRootPath,
        ) {
          const candidate = inside(input.path);
          if (root === undefined || candidate === undefined) return undefined;
          return yield* Effect.gen(function* () {
            const canonicalRoot = yield* fs.realPath(root);
            const canonicalCandidate = yield* fs.realPath(candidate);
            if (!pathIsWithin(canonicalRoot, canonicalCandidate))
              return undefined;
            const metadata = yield* fs.stat(canonicalCandidate);
            return metadata.type === 'File'
              ? { path: canonicalCandidate, size: Number(metadata.size) }
              : undefined;
          }).pipe(Effect.catch(() => Effect.succeed(undefined)));
        }),
        exists: Effect.fn('FilesystemWebRootReader.exists')(function* (
          input: WebRootPath,
        ) {
          const candidate = inside(input.path);
          if (candidate === undefined) return false;
          return yield* syscall(() => lstat(candidate)).pipe(
            Effect.as(true),
            Effect.catch(() => Effect.succeed(false)),
          );
        }),
        open: (input: WebRootFile) =>
          fs
            .stream(input.path)
            .pipe(
              Stream.mapError(
                (cause) =>
                  new Error('Web asset could not be streamed', { cause }),
              ),
            ),
      };
    }),
  );
