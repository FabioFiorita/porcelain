import type { FileLocation } from '../models/file-location.ts';
import type { FileRead, TextRead } from '../models/file-read.ts';

export interface FileReader {
  read(
    location: FileLocation,
    maxBytes: number,
    signal?: AbortSignal,
  ): Promise<FileRead>;
  readText(
    location: FileLocation,
    maxBytes: number,
    signal?: AbortSignal,
  ): Promise<TextRead>;
}
