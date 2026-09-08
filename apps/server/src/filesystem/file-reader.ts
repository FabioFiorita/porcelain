import { constants, type Dirent } from 'node:fs';
import { open, opendir } from 'node:fs/promises';
import type {
  DirectoryListing,
  FileTarget,
  TextContent,
} from '../models/file-content.ts';
import { FileInspectionError } from './errors/file-inspection-error.ts';
import {
  inspectPath,
  sameFile,
  unchanged,
  verifyPath,
} from './inspect-path.ts';
import type { FileReader } from './interfaces/file-reader.ts';
import { mapFilesystemError } from './map-filesystem-error.ts';

const maxBytes = 1024 * 1024;
const maxEntries = 2000;

function checkResponse(
  value: DirectoryListing | TextContent,
  code: 'DIRECTORY_TOO_LARGE' | 'FILE_TOO_LARGE',
) {
  if (Buffer.byteLength(JSON.stringify(value)) > maxBytes)
    throw new FileInspectionError(code);
}

export class NodeFileReader implements FileReader {
  async list(
    target: FileTarget,
    signal?: AbortSignal,
  ): Promise<DirectoryListing> {
    try {
      const before = await inspectPath(target, signal);
      if (!before.info.isDirectory())
        throw new FileInspectionError('PATH_NOT_READABLE');
      const entries: DirectoryListing['entries'] = [];
      const directory = await opendir(before.path);
      for await (const entry of directory) {
        signal?.throwIfAborted();
        if (entry.name.toLowerCase() === '.git') continue;
        if (entries.length === maxEntries)
          throw new FileInspectionError('DIRECTORY_TOO_LARGE');
        entries.push({
          name: entry.name,
          kind: entryKind(entry),
        });
      }
      entries.sort((left, right) =>
        left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
      );
      const result = {
        worktreeId: target.worktreeId,
        path: target.path,
        entries,
      };
      checkResponse(result, 'DIRECTORY_TOO_LARGE');
      await verifyPath(before, target, signal);
      return result;
    } catch (error) {
      return mapFilesystemError(error);
    }
  }

  async read(target: FileTarget, signal?: AbortSignal): Promise<TextContent> {
    try {
      const before = await inspectPath(target, signal);
      if (!before.info.isFile())
        throw new FileInspectionError('PATH_NOT_READABLE');
      const handle = await open(
        before.path,
        constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
      );
      try {
        const opened = await handle.stat({ bigint: true });
        if (!opened.isFile() || !sameFile(before.info, opened))
          throw new FileInspectionError('CONTENT_CHANGED');
        if (opened.size > BigInt(maxBytes))
          throw new FileInspectionError('FILE_TOO_LARGE');
        const buffer = Buffer.alloc(maxBytes + 1);
        const progress = { bytes: 0 };
        while (progress.bytes < buffer.length) {
          signal?.throwIfAborted();
          const { bytesRead } = await handle.read(
            buffer,
            progress.bytes,
            buffer.length - progress.bytes,
            progress.bytes,
          );
          if (bytesRead === 0) break;
          progress.bytes += bytesRead;
        }
        if (progress.bytes > maxBytes)
          throw new FileInspectionError('FILE_TOO_LARGE');
        if (!unchanged(opened, await handle.stat({ bigint: true })))
          throw new FileInspectionError('CONTENT_CHANGED');
        await verifyPath(before, target, signal);
        const text = decodeText(buffer.subarray(0, progress.bytes));
        const result: TextContent = {
          worktreeId: target.worktreeId,
          path: target.path,
          encoding: 'utf-8',
          byteLength: progress.bytes,
          text,
        };
        checkResponse(result, 'FILE_TOO_LARGE');
        return result;
      } finally {
        await handle.close();
      }
    } catch (error) {
      return mapFilesystemError(error);
    }
  }
}
function decodeText(bytes: Buffer) {
  if (bytes.includes(0)) throw new FileInspectionError('UNSUPPORTED_TEXT');
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
      bytes,
    );
  } catch (error) {
    throw new FileInspectionError('UNSUPPORTED_TEXT', { cause: error });
  }
}

function entryKind(entry: Dirent): DirectoryListing['entries'][number]['kind'] {
  if (entry.isSymbolicLink()) return 'symlink';
  if (entry.isDirectory()) return 'directory';
  if (entry.isFile()) return 'file';
  return 'other';
}
