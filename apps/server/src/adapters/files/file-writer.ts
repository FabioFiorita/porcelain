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
import type {
  FileTarget,
  FileEdit,
  FileEditResult,
} from '@porcelain/files/models';
import { FileInspectionError } from '@porcelain/files/errors';
import { NodeFileReader } from './file-reader.ts';
import {
  inspectPath,
  sameFile,
  unchanged,
  verifyPath,
} from './inspect-path.ts';
import type { FileWriter } from '@porcelain/files/ports';
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
          if (!unchanged(before, await lstat(path, { bigint: true })))
            throw new FileInspectionError('CONTENT_CHANGED');
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
      if (error instanceof Error && 'code' in error && error.code === 'EXDEV')
        throw new FileInspectionError('CROSS_DEVICE', { cause: error });
      return mapFilesystemError(error);
    }
  }
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
    if (info.isSymbolicLink())
      await symlink(await readlink(source), destination);
    else await link(source, destination);
    const created = await lstat(destination, { bigint: true });
    try {
      await confirm();
      if (!sameFile(created, await lstat(destination, { bigint: true })))
        throw new FileInspectionError('CONTENT_CHANGED');
      signal?.throwIfAborted();
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
  private async removeReservation(path: string, before: BigIntStats) {
    try {
      const current = await lstat(path, { bigint: true });
      if (!sameFile(before, current)) return;
      if (current.isDirectory()) await rmdir(path);
      else await unlink(path);
    } catch {}
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
