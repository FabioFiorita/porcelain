import type { DirectoryRead } from '../models/directory-listing.ts';
import type { FileLocation } from '../models/file-location.ts';

export interface DirectoryReader {
  list(
    location: FileLocation,
    maxEntries: number,
    signal?: AbortSignal,
  ): Promise<DirectoryRead>;
}
