export type PreviewAsset =
  | { kind: 'asset'; path: string; mediaType: string; base64: string }
  | { kind: 'unavailable'; path: string };
