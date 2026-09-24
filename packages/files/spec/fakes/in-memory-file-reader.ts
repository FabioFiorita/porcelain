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

  read(input: FileReadInput): Promise<FileRead> {
    return Promise.resolve(this.files.get(input.path) ?? missingFile);
  }

  readText(input: FileReadInput): Promise<TextRead> {
    return Promise.resolve(this.texts.get(input.path) ?? missingText);
  }
}
