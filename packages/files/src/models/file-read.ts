import type { FileFailure } from './file-failure.ts';

export type FileRead =
  | { kind: 'file'; bytes: Uint8Array; revision: string }
  | { kind: 'too-large' }
  | { kind: 'failed'; failure: FileFailure };

export type TextRead =
  | { kind: 'text'; text: string; byteLength: number; revision: string }
  | { kind: 'too-large' }
  | { kind: 'failed'; failure: FileFailure };
