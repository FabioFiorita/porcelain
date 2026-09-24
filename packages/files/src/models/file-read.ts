import type { ReadFailure, TextFailure } from './file-failure.ts';

export type FileReadInput = {
  worktreeId: string;
  path: string;
  maxBytes: number;
};

export type FileRead =
  | { kind: 'file'; bytes: Uint8Array; revision: string }
  | { kind: 'too-large' }
  | { kind: 'failed'; failure: ReadFailure };

export type TextRead =
  | { kind: 'text'; text: string; byteLength: number; revision: string }
  | { kind: 'too-large' }
  | { kind: 'failed'; failure: TextFailure };
