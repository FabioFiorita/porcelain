import { Effect, FileSystem } from 'effect';
import type { InstallerContext } from './context.ts';
import { writeFileAtomically } from './json-file.ts';
import { runtimeEntryPoint } from './persistent-runtime.ts';

export type CommandOutcome =
  | { kind: 'written'; path: string; onSearchPath: boolean }
  | { kind: 'foreign'; path: string };

const HEADER =
  '#!/bin/sh\n# Written by the Porcelain service installer; porcelain service uninstall removes it.\n';

function shellArgument(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

function commandScript(context: InstallerContext): string {
  const entryPoint = runtimeEntryPoint(context.paths.runtime, context.pathApi);
  return `${HEADER}exec ${shellArgument(context.nodeExecutable)} ${shellArgument(entryPoint)} "$@"\n`;
}

const readCommand = Effect.fn('Installer.readCommand')(function* (
  path: string,
) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs
    .readFileString(path)
    .pipe(
      Effect.catch((error) =>
        error.reason._tag === 'NotFound'
          ? Effect.succeed(undefined)
          : Effect.fail(error),
      ),
    );
});

export const writePorcelainCommand = Effect.fn(
  'Installer.writePorcelainCommand',
)(function* (context: InstallerContext) {
  const path = context.paths.command;
  const current = yield* readCommand(path);
  if (current !== undefined && !current.startsWith(HEADER)) {
    const foreign: CommandOutcome = { kind: 'foreign', path };
    return foreign;
  }
  yield* writeFileAtomically(path, commandScript(context), 0o755);
  const directory = context.pathApi.dirname(path);
  const written: CommandOutcome = {
    kind: 'written',
    path,
    onSearchPath: context.hostSearchPath
      .split(':')
      .some(
        (entry) => entry !== '' && context.pathApi.resolve(entry) === directory,
      ),
  };
  return written;
});

export const removePorcelainCommand = Effect.fn(
  'Installer.removePorcelainCommand',
)(function* (context: InstallerContext) {
  const fs = yield* FileSystem.FileSystem;
  const current = yield* readCommand(context.paths.command);
  if (current?.startsWith(HEADER))
    yield* fs.remove(context.paths.command, { force: true });
});
