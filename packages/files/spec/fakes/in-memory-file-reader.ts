import { Effect } from 'effect';
import type {
  FileRead,
  FileReadInput,
  TextRead,
} from '../../src/models/file-read.ts';
import type { FileReader } from '../../src/ports/file-reader.ts';

const missingFile: FileRead = { kind: 'failed', failure: 'missing' };
const missingText: TextRead = { kind: 'failed', failure: 'missing' };

export class InMemoryFileReader implements FileReader {
  private readonly files: ReadonlyMap<string, FileRead>;
  private readonly texts: ReadonlyMap<string, TextRead>;

  constructor(stored: {
    files?: Record<string, FileRead> | undefined;
    texts?: Record<string, TextRead> | undefined;
  }) {
    this.files = new Map(Object.entries(stored.files ?? {}));
    this.texts = new Map(Object.entries(stored.texts ?? {}));
  }

  read(input: FileReadInput): Effect.Effect<FileRead> {
    return Effect.succeed(this.files.get(input.path) ?? missingFile);
  }

  readText(input: FileReadInput): Effect.Effect<TextRead> {
    return Effect.succeed(this.texts.get(input.path) ?? missingText);
  }
}
