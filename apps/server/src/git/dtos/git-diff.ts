export type GitDiffResult =
  | { kind: 'text'; patch: string }
  | { kind: 'binary' }
  | { kind: 'metadata-only'; patch: string }
  | {
      kind: 'omitted';
      reason: 'size-limit' | 'unsupported-encoding' | 'unsupported-submodule';
    };
