import { createHash, randomUUID } from 'node:crypto';
import { type BigIntStats, constants } from 'node:fs';
import { lstat, mkdir, open, rename, rmdir, unlink } from 'node:fs/promises';
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
          // Reserve the destination exclusively so ordinary name collisions never replace data.
          signal?.throwIfAborted();
          if (info.isDirectory()) await mkdir(destination, { mode: 0o700 });
          else {
            const handle = await open(destination, 'wx', 0o600);
            await handle.close();
          }
          const reservation = await lstat(destination, { bigint: true });
          try {
            await this.verifyParent(sourceParent, target, signal);
            await this.verifyParent(
              destinationParent,
              destinationTarget,
              signal,
            );
            if (
              !unchanged(info, await lstat(source, { bigint: true })) ||
              !unchanged(
                reservation,
                await lstat(destination, { bigint: true }),
              )
            )
              throw new FileInspectionError('CONTENT_CHANGED');
            signal?.throwIfAborted();
            await rename(source, destination);
          } catch (error) {
            await this.removeReservation(destination, reservation);
            throw error;
          }
          return { path: command.destination };
        }
        case 'trash': {
          const parent = await this.parent(target, signal);
          const path = join(parent.path, basename(command.path));
          const before = await lstat(path, { bigint: true });
          await this.verifyParent(parent, target, signal);
          if (!unchanged(before, await lstat(path, { bigint: true })))
            throw new FileInspectionError('CONTENT_CHANGED');
          signal?.throwIfAborted();
          await this.moveToTrash([path]);
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
      return mapFilesystemError(error);
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
      if (!unchanged(before, current)) return;
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
