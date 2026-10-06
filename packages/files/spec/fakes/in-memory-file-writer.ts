import { Effect } from 'effect';
import type { FileLocation } from '../../src/models/file-location.ts';
import type {
  EntryCopyInput,
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

  write(input: FileWriteInput): Effect.Effect<FileWrite> {
    this.entries.set(input.path, {
      kind: 'file',
      text: input.text,
      basedOn: input.revision,
    });
    return Effect.succeed(written);
  }

  create(input: EntryCreateInput): Effect.Effect<FileWrite> {
    this.entries.set(input.path, {
      kind: input.entryKind,
      text: '',
      basedOn: undefined,
    });
    return Effect.succeed(written);
  }

  move(input: EntryMoveInput): Effect.Effect<FileWrite> {
    this.entries.set(input.destination, this.entries.get(input.path));
    this.entries.delete(input.path);
    return Effect.succeed(written);
  }

  copy(input: EntryCopyInput): Effect.Effect<FileWrite> {
    this.entries.set(input.destination, this.entries.get(input.path));
    return Effect.succeed(written);
  }

  trash(input: FileLocation): Effect.Effect<FileWrite> {
    this.entries.delete(input.path);
    return Effect.succeed(written);
  }
}
