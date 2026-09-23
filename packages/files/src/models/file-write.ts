import type { FileFailure } from './file-failure.ts';

export type FileWrite =
  | { kind: 'written' }
  | { kind: 'failed'; failure: FileFailure };
