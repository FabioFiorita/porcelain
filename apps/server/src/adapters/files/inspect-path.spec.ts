import { it, expect } from 'vitest';
import { NodeServices } from '@effect/platform-node';
import { Effect, FileSystem } from 'effect';
import { inspectPath, verifyPath } from './inspect-path.ts';

it.for(['add', 'remove', 'rename'] as const)(
  'accepts a directory after a child entry changes: %s',
  async (change) => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped();
        yield* fs.makeDirectory(`${root}/folder`);
        yield* fs.writeFileString(`${root}/folder/before`, 'before');
        const target = { root, path: 'folder' };
        const before = yield* inspectPath(target);
        if (change === 'add')
          yield* fs.writeFileString(`${root}/folder/after`, 'after');
        else if (change === 'remove') yield* fs.remove(`${root}/folder/before`);
        else yield* fs.rename(`${root}/folder/before`, `${root}/folder/after`);
        return yield* verifyPath(before, target).pipe(Effect.result);
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
    );
    expect(result._tag).toBe('Success');
  },
);

it.for([
  'directory replaced',
  'ancestor replaced',
  'directory symlinked',
  'directory removed',
  'file rewritten',
  'file replaced',
] as const)('refuses a path after its %s during a read', async (change) => {
  const result = await Effect.runPromise(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped();
      yield* fs.makeDirectory(`${root}/parent/folder`, { recursive: true });
      yield* fs.writeFileString(`${root}/parent/folder/file`, 'before');
      const target = {
        root,
        path: change.startsWith('file')
          ? 'parent/folder/file'
          : 'parent/folder',
      };
      const before = yield* inspectPath(target);
      if (change === 'ancestor replaced') {
        yield* fs.rename(`${root}/parent`, `${root}/old-parent`);
        yield* fs.makeDirectory(`${root}/parent/folder`, { recursive: true });
      } else if (change === 'file rewritten') {
        yield* fs.writeFileString(`${root}/${target.path}`, 'after!');
      } else {
        yield* fs.rename(`${root}/${target.path}`, `${root}/old-target`);
        if (change === 'directory replaced')
          yield* fs.makeDirectory(`${root}/${target.path}`);
        else if (change === 'directory symlinked')
          yield* fs.symlink(`${root}/old-target`, `${root}/${target.path}`);
        else if (change === 'file replaced')
          yield* fs.writeFileString(`${root}/${target.path}`, 'before');
      }
      return yield* verifyPath(before, target).pipe(Effect.result);
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  );
  expect(result).toMatchObject({
    _tag: 'Failure',
    failure: { _tag: 'PathRefusedError', refusal: 'changed' },
  });
});
