import { NodeServices } from '@effect/platform-node';
import { ConfigProvider, Effect, FileSystem, Path } from 'effect';
import { expect, it } from 'vitest';
import { findExecutable } from './find-executable.ts';

const cases = [
  {
    state: 'unreadable fixture configuration disables PATH',
    directory: 'unreadable',
    expected: undefined,
  },
  {
    state: 'explicit fixture overrides PATH',
    directory: 'fixture',
    expected: 'fixture',
  },
  {
    state: 'explicit none disables PATH',
    directory: 'none',
    expected: undefined,
  },
  {
    state: 'unset keeps product PATH lookup',
    directory: undefined,
    expected: 'ambient',
  },
  {
    state: 'missing fixture never falls back',
    directory: 'missing',
    expected: undefined,
  },
  {
    state: 'relative fixture never falls back',
    directory: '.',
    expected: undefined,
  },
  {
    state: 'non-executable fixture never falls back',
    directory: 'non-executable',
    expected: undefined,
  },
  {
    state: 'directory fixture never falls back',
    directory: 'directory',
    expected: undefined,
  },
] as const;

it.each(
  ['codex', 'claude'].flatMap((name) => cases.map((row) => ({ name, ...row }))),
)('$name: $state', async ({ name, directory, expected }) => {
  await Effect.runPromise(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped();
      const fixture = path.join(root, 'fixture');
      const ambient = path.join(root, 'ambient');
      yield* fs.makeDirectory(fixture);
      yield* fs.makeDirectory(ambient);
      yield* fs.writeFileString(path.join(ambient, name), 'ambient');
      yield* fs.chmod(path.join(ambient, name), 0o700);
      if (directory === 'directory')
        yield* fs.makeDirectory(path.join(fixture, name));
      else {
        yield* fs.writeFileString(path.join(fixture, name), 'fixture');
        yield* fs.chmod(
          path.join(fixture, name),
          directory === 'non-executable' ? 0o600 : 0o700,
        );
      }
      const configured =
        directory === 'none' || directory === '.'
          ? directory
          : directory === 'missing'
            ? path.join(root, 'missing')
            : fixture;
      const provider = ConfigProvider.fromUnknown({
        PATH: ambient,
        ...(directory === undefined
          ? {}
          : { PORCELAIN_CODING_TOOL_DIRECTORY: configured }),
      });
      const source =
        directory === 'unreadable'
          ? ConfigProvider.make((key) =>
              key.includes('PORCELAIN_CODING_TOOL_DIRECTORY')
                ? Effect.fail(
                    new ConfigProvider.SourceError({
                      message: 'Fixture configuration unavailable',
                    }),
                  )
                : provider.load(key),
            )
          : provider;
      const resolved = yield* findExecutable(name).pipe(
        Effect.provide(ConfigProvider.layer(source)),
      );
      expect(resolved).toBe(
        expected === undefined ? undefined : path.join(root, expected, name),
      );
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  );
});
