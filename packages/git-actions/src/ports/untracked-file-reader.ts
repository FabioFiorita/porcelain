import type {
  UntrackedFileRead,
  UntrackedFileRequest,
} from '../models/commit-draft-evidence.ts';

export interface UntrackedFileReader {
  read(
    input: UntrackedFileRequest,
    signal?: AbortSignal,
  ): Promise<UntrackedFileRead>;
}
