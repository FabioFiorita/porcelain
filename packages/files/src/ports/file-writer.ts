import type { FileLocation } from '../models/file-location.ts';
import type { FileWrite } from '../models/file-write.ts';

export interface FileWriter {
  write(
    location: FileLocation,
    text: string,
    revision: string,
    signal?: AbortSignal,
  ): Promise<FileWrite>;
  create(
    location: FileLocation,
    entryKind: 'file' | 'directory',
    signal?: AbortSignal,
  ): Promise<FileWrite>;
  move(
    location: FileLocation,
    destination: string,
    signal?: AbortSignal,
  ): Promise<FileWrite>;
  trash(location: FileLocation, signal?: AbortSignal): Promise<FileWrite>;
}
