import { admittedWrite } from '@porcelain/effects';
import { Effect, Layer, type Scope } from 'effect';
import { randomUUID } from 'node:crypto';
import { type BigIntStats, constants } from 'node:fs';
import {
  type FileHandle,
  link,
  lstat,
  mkdir,
  readlink,
  rename,
  rmdir,
  symlink,
  unlink,
} from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import trash from 'trash';
import type {
  EntryCopyInput,
  EntryCreateInput,
  EntryMoveInput,
  FileLocation,
  FileWrite,
  FileWriteInput,
} from '@porcelain/files/models';
import { FileWriter } from '@porcelain/files/ports';
import {
  type CheckoutPath,
  type InspectedPath,
  filesystemFailure,
  inspectPath,
  type GuardedPathFailure,
  pathRefused,
  fileIdentity,
  sameEvidence,
  sameFile,
  unchanged,
  verifyPath,
} from './inspect-path.ts';
import { openGuardedFile, syscall } from './guarded-filesystem-syscalls.ts';
import {
  listedWorktreeEffect,
  type ListedWorktrees,
} from '../projects/checkout-session.ts';

type Source = {
  info: BigIntStats;
  path: string;
  parent: InspectedPath;
  target: CheckoutPath;
};
type Destination = {
  path: string;
  parent: InspectedPath;
  target: CheckoutPath;
};
type FileWriterOptions = {
  fileMode: number;
  directoryMode: number;
  temporaryName: (id: string) => string;
};
const exclusiveWrite =
  constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL;

const parent = Effect.fn('FilesystemFileWriter.parent')(function* (
  target: CheckoutPath,
) {
  const folder = dirname(target.path);
  const inspected = yield* inspectPath({
    ...target,
    path: folder === '.' ? '' : folder,
  });
  if (!inspected.info.isDirectory())
    return yield* Effect.fail(pathRefused('unreadable'));
  return inspected;
});

const verifyParent = Effect.fn('FilesystemFileWriter.verifyParent')(function* (
  before: InspectedPath,
  target: CheckoutPath,
) {
  const after = yield* parent(target);
  if (!sameEvidence(before, after))
    return yield* Effect.fail(pathRefused('changed'));
});

const removeReservation = Effect.fn('FilesystemFileWriter.removeReservation')(
  function* (path: string, before: BigIntStats) {
    const current = yield* syscall(() => lstat(path, { bigint: true }));
    if (!sameFile(before, current)) return;
    yield* syscall(() => (current.isDirectory() ? rmdir(path) : unlink(path)));
  },
  Effect.catch(() => Effect.void),
);

const copyContents = Effect.fn('FilesystemFileWriter.copyContents')(function* (
  reading: FileHandle,
  writing: FileHandle,
  maxBytes: number,
) {
  let copied = 0;
  for (;;) {
    const { bytesRead, buffer } = yield* syscall(() => reading.read());
    if (bytesRead === 0) return;
    copied += bytesRead;
    if (copied > maxBytes) return yield* Effect.fail(pathRefused('too-large'));
    let chunk = buffer.subarray(0, bytesRead);
    while (chunk.length > 0) {
      const { bytesWritten } = yield* syscall(() => writing.write(chunk));
      if (bytesWritten === 0)
        return yield* Effect.die(new Error('File copy made no write progress'));
      chunk = chunk.subarray(bytesWritten);
    }
  }
});

export const filesystemFileWriterLayer = (
  worktrees: ListedWorktrees,
  options: FileWriterOptions,
) =>
  Layer.sync(FileWriter, () => {
    const locate = Effect.fn('FilesystemFileWriter.locate')(function* (
      location: FileLocation,
    ) {
      const checkout = yield* listedWorktreeEffect(
        worktrees,
        location.worktreeId,
      ).pipe(Effect.orDie);
      return { root: checkout.path, path: location.path };
    });
    const attempt = (
      worktreeId: string,
      work: (
        commit: <A>(
          effect: Effect.Effect<A, GuardedPathFailure>,
        ) => Effect.Effect<A, GuardedPathFailure>,
      ) => Effect.Effect<void, GuardedPathFailure, Scope.Scope>,
    ) =>
      admittedWrite(worktreeId, (committed) =>
        Effect.gen(function* (): Effect.fn.Return<FileWrite> {
          const commit = <A>(effect: Effect.Effect<A, GuardedPathFailure>) =>
            Effect.uninterruptible(
              effect.pipe(Effect.tap(() => Effect.sync(committed))),
            );
          return yield* Effect.scoped(work(commit)).pipe(
            Effect.as<FileWrite>({ kind: 'written' }),
            Effect.catch((error) => {
              const failure = filesystemFailure(error);
              return failure === undefined
                ? Effect.die(error)
                : Effect.succeed<FileWrite>({ kind: 'failed', failure });
            }),
          );
        }),
      );

    const write = Effect.fn('FilesystemFileWriter.write')(
      (input: FileWriteInput) =>
        attempt(input.worktreeId, (commit) =>
          Effect.gen(function* () {
            const target = yield* locate(input);
            const before = yield* inspectPath(target);
            if (fileIdentity(before.info) !== input.revision)
              return yield* Effect.fail(pathRefused('changed'));
            const folder = yield* parent(target);
            const temporary = join(
              folder.path,
              options.temporaryName(randomUUID()),
            );
            let committed = false;
            let opened = false;
            yield* Effect.addFinalizer(() =>
              committed || !opened
                ? Effect.void
                : syscall(() => unlink(temporary)).pipe(
                    Effect.catch(() => Effect.void),
                  ),
            );
            const handle = yield* Effect.uninterruptible(
              openGuardedFile(
                temporary,
                exclusiveWrite,
                Number(before.info.mode & 0o777n),
              ).pipe(
                Effect.tap(() =>
                  Effect.sync(() => {
                    opened = true;
                  }),
                ),
              ),
            );
            yield* syscall((signal) =>
              handle.writeFile(input.text, { encoding: 'utf8', signal }),
            );
            yield* syscall(() => handle.sync());
            yield* verifyPath(before, target);
            yield* verifyParent(folder, target);
            yield* commit(
              syscall(() => rename(temporary, before.path)).pipe(
                Effect.tap(() =>
                  Effect.sync(() => {
                    committed = true;
                  }),
                ),
              ),
            );
          }),
        ),
    );

    const create = Effect.fn('FilesystemFileWriter.create')(
      (input: EntryCreateInput) =>
        attempt(input.worktreeId, (commit) =>
          Effect.gen(function* () {
            const target = yield* locate(input);
            const folder = yield* parent(target);
            const path = join(folder.path, basename(target.path));
            let committed = false;
            yield* Effect.acquireRelease(
              Effect.scoped(
                Effect.gen(function* () {
                  if (input.entryKind === 'directory') {
                    yield* syscall(() => mkdir(path));
                    return yield* syscall(() => lstat(path, { bigint: true }));
                  }
                  const file = yield* openGuardedFile(
                    path,
                    exclusiveWrite,
                    options.fileMode,
                  );
                  return yield* syscall(() => file.stat({ bigint: true }));
                }),
              ),
              (info) =>
                committed ? Effect.void : removeReservation(path, info),
            );
            yield* verifyParent(folder, target);
            yield* commit(
              Effect.sync(() => {
                committed = true;
              }),
            );
          }),
        ),
    );

    const moveEntry = Effect.fn('FilesystemFileWriter.moveEntry')(function* (
      from: Source,
      to: Destination,
      commit: <A>(
        effect: Effect.Effect<A, GuardedPathFailure>,
      ) => Effect.Effect<A, GuardedPathFailure>,
    ) {
      const confirm = Effect.gen(function* () {
        yield* verifyParent(from.parent, from.target);
        yield* verifyParent(to.parent, to.target);
        if (
          !sameFile(
            from.info,
            yield* syscall(() => lstat(from.path, { bigint: true })),
          )
        )
          return yield* Effect.fail(pathRefused('changed'));
      });
      let committed = false;
      const reservation = yield* Effect.acquireRelease(
        Effect.gen(function* () {
          if (from.info.isDirectory())
            yield* syscall(() =>
              mkdir(to.path, { mode: options.directoryMode }),
            );
          else if (from.info.isSymbolicLink()) {
            const target = yield* syscall(() => readlink(from.path));
            yield* syscall(() => symlink(target, to.path));
          } else yield* syscall(() => link(from.path, to.path));
          return yield* syscall(() => lstat(to.path, { bigint: true }));
        }),
        (info) => (committed ? Effect.void : removeReservation(to.path, info)),
      );
      yield* confirm;
      const destination = yield* syscall(() =>
        lstat(to.path, { bigint: true }),
      );
      if (from.info.isDirectory()) {
        if (!unchanged(reservation, destination))
          return yield* Effect.fail(pathRefused('changed'));
        yield* commit(
          syscall(() => rename(from.path, to.path)).pipe(
            Effect.tap(() =>
              Effect.sync(() => {
                committed = true;
              }),
            ),
          ),
        );
        return;
      }
      if (!sameFile(reservation, destination))
        return yield* Effect.fail(pathRefused('changed'));
      const remaining = yield* syscall(() =>
        lstat(from.path, { bigint: true }),
      );
      if (
        !sameFile(from.info, remaining) ||
        (!from.info.isSymbolicLink() && !sameFile(reservation, remaining))
      )
        return yield* Effect.fail(pathRefused('changed'));
      yield* commit(
        syscall(() => unlink(from.path)).pipe(
          Effect.tap(() =>
            Effect.sync(() => {
              committed = true;
            }),
          ),
        ),
      );
    });

    const move = Effect.fn('FilesystemFileWriter.move')(
      (input: EntryMoveInput) =>
        attempt(input.worktreeId, (commit) =>
          Effect.gen(function* () {
            const target = yield* locate(input);
            const sourceParent = yield* parent(target);
            const source = join(sourceParent.path, basename(target.path));
            const info = yield* syscall(() => lstat(source, { bigint: true }));
            const destinationTarget = { ...target, path: input.destination };
            const destinationParent = yield* parent(destinationTarget);
            yield* moveEntry(
              { info, path: source, parent: sourceParent, target },
              {
                path: join(destinationParent.path, basename(input.destination)),
                parent: destinationParent,
                target: destinationTarget,
              },
              commit,
            );
          }),
        ),
    );

    const copy = Effect.fn('FilesystemFileWriter.copy')(
      (input: EntryCopyInput) =>
        attempt(input.worktreeId, (commit) =>
          Effect.gen(function* () {
            const target = yield* locate(input);
            const sourceParent = yield* parent(target);
            const source = join(sourceParent.path, basename(target.path));
            const info = yield* syscall(() => lstat(source, { bigint: true }));
            if (!info.isFile())
              return yield* Effect.fail(pathRefused('unreadable'));
            if (info.size > BigInt(input.maxBytes))
              return yield* Effect.fail(pathRefused('too-large'));
            const destinationTarget = { ...target, path: input.destination };
            const destinationParent = yield* parent(destinationTarget);
            const destination = join(
              destinationParent.path,
              basename(input.destination),
            );
            const reading = yield* openGuardedFile(source, constants.O_RDONLY);
            if (
              !sameFile(
                info,
                yield* syscall(() => reading.stat({ bigint: true })),
              )
            )
              return yield* Effect.fail(pathRefused('changed'));
            let committed = false;
            let created: BigIntStats | undefined;
            yield* Effect.addFinalizer(() =>
              !committed && created !== undefined
                ? removeReservation(destination, created)
                : Effect.void,
            );
            const writing = yield* Effect.uninterruptible(
              Effect.gen(function* () {
                const handle = yield* openGuardedFile(
                  destination,
                  exclusiveWrite,
                  Number(info.mode & 0o777n),
                );
                created = yield* syscall(() => handle.stat({ bigint: true }));
                return handle;
              }),
            );
            yield* copyContents(reading, writing, input.maxBytes);
            yield* syscall(() => writing.sync());
            yield* verifyParent(sourceParent, target);
            yield* verifyParent(destinationParent, destinationTarget);
            if (
              !unchanged(
                info,
                yield* syscall(() => lstat(source, { bigint: true })),
              )
            )
              return yield* Effect.fail(pathRefused('changed'));
            yield* commit(
              Effect.sync(() => {
                committed = true;
              }),
            );
          }),
        ),
    );

    const trashEntry = Effect.fn('FilesystemFileWriter.trash')(
      (input: FileLocation) =>
        attempt(input.worktreeId, (commit) =>
          Effect.gen(function* () {
            const target = yield* locate(input);
            const folder = yield* parent(target);
            const path = join(folder.path, basename(target.path));
            const before = yield* syscall(() => lstat(path, { bigint: true }));
            yield* verifyParent(folder, target);
            if (
              !unchanged(
                before,
                yield* syscall(() => lstat(path, { bigint: true })),
              )
            )
              return yield* Effect.fail(pathRefused('changed'));
            yield* commit(
              syscall(() => trash([path], { glob: false })).pipe(
                Effect.mapError((cause) =>
                  pathRefused('trash-unavailable', { cause }),
                ),
              ),
            );
          }),
        ),
    );
    return { write, create, move, copy, trash: trashEntry };
  });
