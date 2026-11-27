export type PreviewAsset =
  | { kind: 'asset'; path: string; mediaType: string; base64: string }
  | { kind: 'stream'; path: string }
  | { kind: 'unavailable'; path: string };
