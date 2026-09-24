import { randomUUID } from 'node:crypto';
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
  EntryCreateInput,
  EntryMoveInput,
  FileLocation,
  FileWrite,
  FileWriteInput,
} from '@porcelain/files/models';
import type { FileWriter } from '@porcelain/files/ports';
import {
  type CheckoutPath,
  type InspectedPath,
  filesystemFailure,
  inspectPath,
  pathRefused,
  fileIdentity,
  sameEvidence,
  sameFile,
  unchanged,
  verifyPath,
} from './inspect-path.ts';
import {
  listedWorktree,
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

export type FilePermissions = { fileMode: number; directoryMode: number };

export type FileWriterOptions = FilePermissions & {
  temporaryName: (id: string) => string;
};

export class FilesystemFileWriter implements FileWriter {
  private readonly worktrees: ListedWorktrees;
  private readonly options: FileWriterOptions;

  constructor(worktrees: ListedWorktrees, options: FileWriterOptions) {
    this.worktrees = worktrees;
    this.options = options;
  }

  async write(input: FileWriteInput, signal?: AbortSignal): Promise<FileWrite> {
    const target = await this.locate(input, signal);
    return this.attempt(async () => {
      const before = await inspectPath(target, signal);
      if (fileIdentity(before.info) !== input.revision)
        throw pathRefused('changed');
      const parent = await this.parent(target, signal);
      const temporary = join(
        parent.path,
        this.options.temporaryName(randomUUID()),
      );
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
        await handle.writeFile(input.text, {
          encoding: 'utf8',
          ...(signal ? { signal } : {}),
        });
        await handle.sync();
        await verifyPath(before, target, signal);
        await this.verifyParent(parent, target, signal);
        signal?.throwIfAborted();
        await rename(temporary, before.path);
        committed = true;
      } finally {
        await handle.close();
        if (!committed) await unlink(temporary).catch(() => undefined);
      }
    });
  }

  async create(
    input: EntryCreateInput,
    signal?: AbortSignal,
  ): Promise<FileWrite> {
    const target = await this.locate(input, signal);
    return this.attempt(async () => {
      const parent = await this.parent(target, signal);
      signal?.throwIfAborted();
      const path = join(parent.path, basename(target.path));
      if (input.entryKind === 'directory') await mkdir(path);
      else {
        const file = await open(
          path,
          constants.O_WRONLY |
            constants.O_CREAT |
            constants.O_EXCL |
            constants.O_NOFOLLOW,
          this.options.fileMode,
        );
        await file.close();
      }
      const made = await lstat(path, { bigint: true });
      try {
        await this.verifyParent(parent, target, signal);
      } catch (error) {
        await removeReservation(path, made);
        throw error;
      }
    });
  }

  async move(input: EntryMoveInput, signal?: AbortSignal): Promise<FileWrite> {
    const target = await this.locate(input, signal);
    return this.attempt(async () => {
      const sourceParent = await this.parent(target, signal);
      const source = join(sourceParent.path, basename(target.path));
      const info = await lstat(source, { bigint: true });
      const destinationTarget = { ...target, path: input.destination };
      const destinationParent = await this.parent(destinationTarget, signal);
      signal?.throwIfAborted();
      await this.moveEntry(
        { info, path: source, parent: sourceParent, target },
        {
          path: join(destinationParent.path, basename(input.destination)),
          parent: destinationParent,
          target: destinationTarget,
        },
        signal,
      );
    });
  }

  async trash(input: FileLocation, signal?: AbortSignal): Promise<FileWrite> {
    const target = await this.locate(input, signal);
    return this.attempt(async () => {
      const parent = await this.parent(target, signal);
      const path = join(parent.path, basename(target.path));
      const before = await lstat(path, { bigint: true });
      await this.verifyParent(parent, target, signal);
      signal?.throwIfAborted();
      if (!unchanged(before, await lstat(path, { bigint: true })))
        throw pathRefused('changed');
      try {
        await trash([path], { glob: false });
      } catch (cause) {
        throw pathRefused('trash-unavailable', { cause });
      }
    });
  }

  private async locate(
    location: FileLocation,
    signal?: AbortSignal,
  ): Promise<CheckoutPath> {
    const checkout = await listedWorktree(
      this.worktrees,
      location.worktreeId,
      signal,
    );
    return { root: checkout.path, path: location.path };
  }

  private async attempt(work: () => Promise<void>): Promise<FileWrite> {
    try {
      await work();
      return { kind: 'written' };
    } catch (error) {
      const failure = filesystemFailure(error);
      if (failure === undefined) throw error;
      return { kind: 'failed', failure };
    }
  }

  private async moveEntry(from: Source, to: Destination, signal?: AbortSignal) {
    const confirm = async () => {
      await this.verifyParent(from.parent, from.target, signal);
      await this.verifyParent(to.parent, to.target, signal);
      if (!sameFile(from.info, await lstat(from.path, { bigint: true })))
        throw pathRefused('changed');
    };
    if (from.info.isDirectory()) {
      await mkdir(to.path, { mode: this.options.directoryMode });
      const reservation = await lstat(to.path, { bigint: true });
      try {
        await confirm();
        if (!unchanged(reservation, await lstat(to.path, { bigint: true })))
          throw pathRefused('changed');
        signal?.throwIfAborted();
        await rename(from.path, to.path);
      } catch (error) {
        await removeReservation(to.path, reservation);
        throw error;
      }
      return;
    }
    if (from.info.isSymbolicLink())
      await symlink(await readlink(from.path), to.path);
    else await link(from.path, to.path);
    const created = await lstat(to.path, { bigint: true });
    try {
      await confirm();
      if (!sameFile(created, await lstat(to.path, { bigint: true })))
        throw pathRefused('changed');
      signal?.throwIfAborted();
      const remaining = await lstat(from.path, { bigint: true });
      if (!sameFile(from.info, remaining)) throw pathRefused('changed');
      if (!from.info.isSymbolicLink() && !sameFile(created, remaining))
        throw pathRefused('changed');
      await unlink(from.path);
    } catch (error) {
      await removeReservation(to.path, created);
      throw error;
    }
  }

  private async parent(target: CheckoutPath, signal?: AbortSignal) {
    const folder = dirname(target.path);
    const parent = await inspectPath(
      { ...target, path: folder === '.' ? '' : folder },
      signal,
    );
    if (!parent.info.isDirectory()) throw pathRefused('unreadable');
    return parent;
  }

  private async verifyParent(
    before: InspectedPath,
    target: CheckoutPath,
    signal?: AbortSignal,
  ) {
    const after = await this.parent(target, signal);
    if (!sameEvidence(before, after)) throw pathRefused('changed');
  }
}

async function removeReservation(path: string, before: BigIntStats) {
  try {
    const current = await lstat(path, { bigint: true });
    if (!sameFile(before, current)) return;
    if (current.isDirectory()) await rmdir(path);
    else await unlink(path);
  } catch {}
}
