export type BlobAtOidRequest = { oid: string; path: string; maxBytes: number };

export type BlobAtOid =
  | { kind: 'bytes'; blobOid: string; bytes: Uint8Array }
  | { kind: 'too-large'; blobOid: string }
  | { kind: 'missing' };
