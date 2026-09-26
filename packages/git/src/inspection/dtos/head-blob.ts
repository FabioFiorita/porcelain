export type HeadBlobRequest = { path: string; maxBytes: number };

export type HeadBlob =
  | { kind: 'bytes'; bytes: Uint8Array }
  | { kind: 'too-large' };
