import { createHash, randomUUID } from 'node:crypto';
import { type BigIntStats, constants } from 'node:fs';
import {
  link,
  lstat,
  mkdir,
  open,
  readlink,
  rename,
  rmdir,
  symlink,
  unlink,
} from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import trash from 'trash';
import type { FileTarget } from '../models/file-content.ts';
import type { FileEdit, FileEditResult } from '../models/file-edit.ts';
import { FileInspectionError } from './errors/file-inspection-error.ts';
import { NodeFileReader } from './file-reader.ts';
import {
  inspectPath,
  sameFile,
  unchanged,
  verifyPath,
} from './inspect-path.ts';
import type { FileWriter } from './interfaces/file-writer.ts';
import { mapFilesystemError } from './map-filesystem-error.ts';

const fingerprint = (text: string) =>
  createHash('sha256').update(text).digest('hex');

export class NodeFileWriter implements FileWriter {
  private readonly moveToTrash: (paths: string[]) => Promise<void>;
  constructor(
    moveToTrash = (paths: string[]) => trash(paths, { glob: false }),
  ) {
    this.moveToTrash = moveToTrash;
  }
  async edit(
    root: string,
    command: FileEdit,
    signal?: AbortSignal,
  ): Promise<FileEditResult> {
    const target = { root, path: command.path, worktreeId: '' };
    try {
      switch (command.kind) {
        case 'write':
          return await this.write(
            target,
            command.text,
            command.expectedFingerprint,
            signal,
          );
        case 'create': {
          const parent = await this.parent(target, signal);
          signal?.throwIfAborted();
          const path = join(parent.path, basename(command.path));
          if (command.entryKind === 'directory') await mkdir(path);
          else {
            const file = await open(
              path,
              constants.O_WRONLY |
                constants.O_CREAT |
                constants.O_EXCL |
                constants.O_NOFOLLOW,
              0o644,
            );
            await file.close();
          }
          // Inspecting the parent and then creating by pathname are two
          // moments. An ancestor swapped to a link in between would have put
          // this entry outside the checkout, so the ancestors are checked
          // again and the request refuses. Taking the entry back is by name,
          // so an ancestor put back before this check hides what was created
          // outside: refusal is certain, removal is not. See the narrowed
          // promise in docs/decisions/files-read-boundary.md.
          const made = await lstat(path, { bigint: true });
          try {
            await this.verifyParent(parent, target, signal);
          } catch (error) {
            await this.removeReservation(path, made);
            throw error;
          }
          return { path: command.path };
        }
        case 'move': {
          const sourceParent = await this.parent(target, signal);
          const source = join(sourceParent.path, basename(command.path));
          const info = await lstat(source, { bigint: true });
          const destinationTarget = { ...target, path: command.destination };
          const destinationParent = await this.parent(
            destinationTarget,
            signal,
          );
          const destination = join(
            destinationParent.path,
            basename(command.destination),
          );
          if (
            source === destination ||
            (info.isDirectory() && destination.startsWith(`${source}/`))
          )
            throw new FileInspectionError('INVALID_REQUEST');
          signal?.throwIfAborted();
          await this.moveEntry(
            { info, source, sourceParent, target },
            { destination, destinationParent, destinationTarget },
            signal,
          );
          return { path: command.destination };
        }
        case 'trash': {
          const parent = await this.parent(target, signal);
          const path = join(parent.path, basename(command.path));
          const before = await lstat(path, { bigint: true });
          await this.verifyParent(parent, target, signal);
          signal?.throwIfAborted();
          // Checked immediately before the handoff and nothing in between:
          // the trash implementation takes a pathname, so this is the last
          // moment anything can be said about what that name holds.
          if (!unchanged(before, await lstat(path, { bigint: true })))
            throw new FileInspectionError('CONTENT_CHANGED');
          // Delete means recoverable. If this machine has nowhere to put the
          // file, the answer is that it was not deleted — never an unlink,
          // which would quietly make the one thing the owner chose trash for
          // impossible.
          try {
            await this.moveToTrash([path]);
          } catch (cause) {
            throw new FileInspectionError('TRASH_UNAVAILABLE', { cause });
          }
          return { path: command.path };
        }
      }
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        (error.code === 'EEXIST' || error.code === 'ENOTEMPTY')
      )
        throw new FileInspectionError('ENTRY_EXISTS', { cause: error });
      // A move between filesystems is not a rename. Copying and deleting
      // instead would give up the atomicity the no-replace step exists for and
      // could half-move a directory, so it is refused and nothing is touched.
      if (error instanceof Error && 'code' in error && error.code === 'EXDEV')
        throw new FileInspectionError('CROSS_DEVICE', { cause: error });
      return mapFilesystemError(error);
    }
  }
  /**
   * A move that cannot replace what it did not put there.
   *
   * `rename` is the wrong last step for a file: it silently overwrites, so a
   * writer who replaced a reserved name between the check and the rename would
   * lose their data. `link` and `symlink` refuse an existing name outright,
   * which is the guarantee this operation actually promises. A directory has
   * no such primitive in Node, so it keeps a reservation and `rename` — which
   * refuses a file and a non-empty directory, leaving only an empty directory
   * that appeared in place of the reservation as something it could replace.
   */
  private async moveEntry(
    from: {
      info: BigIntStats;
      source: string;
      sourceParent: Awaited<ReturnType<typeof inspectPath>>;
      target: FileTarget;
    },
    to: {
      destination: string;
      destinationParent: Awaited<ReturnType<typeof inspectPath>>;
      destinationTarget: FileTarget;
    },
    signal?: AbortSignal,
  ) {
    const { info, source, sourceParent, target } = from;
    const { destination, destinationParent, destinationTarget } = to;
    // A move is about identity, not content: `sameFile` asks whether this is
    // still the entry that was going to be moved. `unchanged` cannot be used
    // here because linking the new name moves the source's change time itself.
    const confirm = async () => {
      await this.verifyParent(sourceParent, target, signal);
      await this.verifyParent(destinationParent, destinationTarget, signal);
      if (!sameFile(info, await lstat(source, { bigint: true })))
        throw new FileInspectionError('CONTENT_CHANGED');
    };
    if (info.isDirectory()) {
      await mkdir(destination, { mode: 0o700 });
      const reservation = await lstat(destination, { bigint: true });
      try {
        await confirm();
        if (!unchanged(reservation, await lstat(destination, { bigint: true })))
          throw new FileInspectionError('CONTENT_CHANGED');
        signal?.throwIfAborted();
        await rename(source, destination);
      } catch (error) {
        await this.removeReservation(destination, reservation);
        throw error;
      }
      return;
    }
    // Creating the new name is the step that refuses a collision, so it comes
    // first and nothing has to be reserved.
    if (info.isSymbolicLink())
      await symlink(await readlink(source), destination);
    else await link(source, destination);
    const created = await lstat(destination, { bigint: true });
    try {
      await confirm();
      // Nothing may have taken the new name from under us either.
      if (!sameFile(created, await lstat(destination, { bigint: true })))
        throw new FileInspectionError('CONTENT_CHANGED');
      signal?.throwIfAborted();
      // The last thing checked is the thing about to be destroyed, and for a
      // file it is checked against the link just made: source and destination
      // share an inode, so anything else at the old name is not this file.
      // `unlink` still takes a name, not this entry, so a substitution landing
      // after this check is what gets removed — as tight as the window gets
      // without `unlinkat`, which Node does not offer. See the narrowed
      // promise in docs/decisions/files-read-boundary.md.
      const remaining = await lstat(source, { bigint: true });
      if (!sameFile(info, remaining))
        throw new FileInspectionError('CONTENT_CHANGED');
      if (!info.isSymbolicLink() && !sameFile(created, remaining))
        throw new FileInspectionError('CONTENT_CHANGED');
      await unlink(source);
    } catch (error) {
      await this.removeReservation(destination, created);
      throw error;
    }
  }

  private async parent(target: FileTarget, signal?: AbortSignal) {
    const parent = await inspectPath(
      {
        ...target,
        path: dirname(target.path) === '.' ? '' : dirname(target.path),
      },
      signal,
    );
    if (!parent.info.isDirectory())
      throw new FileInspectionError('PATH_NOT_READABLE');
    return parent;
  }
  private async verifyParent(
    before: Awaited<ReturnType<typeof inspectPath>>,
    target: FileTarget,
    signal?: AbortSignal,
  ) {
    const after = await this.parent(target, signal);
    if (
      before.evidence.some((entry, index) => {
        const current = after.evidence[index];
        return !current || !sameFile(entry.info, current.info);
      })
    )
      throw new FileInspectionError('CONTENT_CHANGED');
  }
  /**
   * Takes back only the entry this operation created.
   *
   * Identity, not content: a hard link's change time moves when the other name
   * for it is removed, so comparing more than identity would leave the link
   * behind exactly when a refused move needs it gone.
   */
  private async removeReservation(path: string, before: BigIntStats) {
    try {
      const current = await lstat(path, { bigint: true });
      if (!sameFile(before, current)) return;
      if (current.isDirectory()) await rmdir(path);
      else await unlink(path);
    } catch {
      /* Never remove a destination that another writer changed. */
    }
  }
  private async write(
    target: FileTarget,
    text: string,
    expected: string,
    signal?: AbortSignal,
  ) {
    const before = await inspectPath(target, signal);
    const current = await new NodeFileReader().read(target, signal);
    if (fingerprint(current.text) !== expected)
      throw new FileInspectionError('CONTENT_CHANGED');
    const parent = await this.parent(target, signal);
    const temporary = join(parent.path, `.porcelain-${randomUUID()}.tmp`);
    const handle = await open(
      temporary,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      Number(before.info.mode & 0o777n),
    );
    let committed = false;
    try {
      await handle.writeFile(text, {
        encoding: 'utf8',
        ...(signal ? { signal } : {}),
      });
      await handle.sync();
      await verifyPath(before, target, signal);
      await this.verifyParent(parent, target, signal);
      signal?.throwIfAborted();
      await rename(temporary, before.path);
      committed = true;
      return { path: target.path, contentFingerprint: fingerprint(text) };
    } finally {
      await handle.close();
      if (!committed) await unlink(temporary).catch(() => undefined);
    }
  }
}
