import { NodeFileSystem } from '@effect/platform-node';
import { Context, Effect, FileSystem, Layer } from 'effect';

export class Persistence extends Context.Service<Persistence, string>()(
  '@porcelain/desktop/spec/Persistence',
) {
  static readonly layer = Layer.effect(
    Persistence,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      return yield* fs.makeTempDirectoryScoped({
        prefix: 'porcelain-desktop-persistence-',
      });
    }),
  ).pipe(Layer.provideMerge(NodeFileSystem.layer));
}
