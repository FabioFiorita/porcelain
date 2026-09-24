import type {
  DirectoryRead,
  DirectoryReadInput,
} from '../models/directory-read.ts';

export interface DirectoryReader {
  list(input: DirectoryReadInput, signal?: AbortSignal): Promise<DirectoryRead>;
}
