import type { FileLocation } from '../../src/models/file-location.ts';
import type {
  EntryCreateInput,
  EntryMoveInput,
  FileWrite,
  FileWriteInput,
} from '../../src/models/file-write.ts';
import type { FileWriter } from '../../src/ports/file-writer.ts';

export type StoredEntry = {
  kind: 'file' | 'directory';
  text: string;
  basedOn: string | undefined;
};

const written: FileWrite = { kind: 'written' };

export class InMemoryFileWriter implements FileWriter {
  private readonly entries: Map<string, StoredEntry | undefined>;

  constructor(entries: Record<string, StoredEntry> = {}) {
    this.entries = new Map<string, StoredEntry | undefined>(
      Object.entries(entries),
    );
  }

  entry(path: string): StoredEntry | undefined {
    return this.entries.get(path);
  }

  write(input: FileWriteInput): Promise<FileWrite> {
    this.entries.set(input.path, {
      kind: 'file',
      text: input.text,
      basedOn: input.revision,
    });
    return Promise.resolve(written);
  }

  create(input: EntryCreateInput): Promise<FileWrite> {
    this.entries.set(input.path, {
      kind: input.entryKind,
      text: '',
      basedOn: undefined,
    });
    return Promise.resolve(written);
  }

  move(input: EntryMoveInput): Promise<FileWrite> {
    this.entries.set(input.destination, this.entries.get(input.path));
    this.entries.delete(input.path);
    return Promise.resolve(written);
  }

  trash(input: FileLocation): Promise<FileWrite> {
    this.entries.delete(input.path);
    return Promise.resolve(written);
  }
}
