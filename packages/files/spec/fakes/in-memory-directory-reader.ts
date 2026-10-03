import type {
  DirectoryRead,
  DirectoryReadInput,
} from '../../src/models/directory-read.ts';
import type { DirectoryReader } from '../../src/ports/directory-reader.ts';

const missing: DirectoryRead = { kind: 'failed', failure: 'missing' };

export class InMemoryDirectoryReader implements DirectoryReader {
  private readonly listings: ReadonlyMap<string, DirectoryRead>;

  constructor(listings: Record<string, DirectoryRead>) {
    this.listings = new Map(Object.entries(listings));
  }

  list(input: DirectoryReadInput): Promise<DirectoryRead> {
    return Promise.resolve(this.listings.get(input.path) ?? missing);
  }
}
