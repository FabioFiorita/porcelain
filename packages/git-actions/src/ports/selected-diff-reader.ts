import type { SelectedDiffRequest } from '../models/commit-draft-evidence.ts';

export interface SelectedDiffReader {
  read(input: SelectedDiffRequest, signal?: AbortSignal): Promise<string>;
}
