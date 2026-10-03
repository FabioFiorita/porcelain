import type { FileLocation } from '../models/file-location.ts';
import type {
  EntryCopyInput,
  EntryCreateInput,
  EntryMoveInput,
  FileWrite,
  FileWriteInput,
} from '../models/file-write.ts';

export interface FileWriter {
  write(input: FileWriteInput, signal?: AbortSignal): Promise<FileWrite>;
  create(input: EntryCreateInput, signal?: AbortSignal): Promise<FileWrite>;
  move(input: EntryMoveInput, signal?: AbortSignal): Promise<FileWrite>;
  trash(input: FileLocation, signal?: AbortSignal): Promise<FileWrite>;
  copy(input: EntryCopyInput, signal?: AbortSignal): Promise<FileWrite>;
}
