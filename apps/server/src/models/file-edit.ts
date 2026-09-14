export type FileEdit =
  | { kind: 'write'; path: string; text: string; expectedFingerprint: string }
  | { kind: 'create'; path: string; entryKind: 'file' | 'directory' }
  | { kind: 'move'; path: string; destination: string }
  | { kind: 'trash'; path: string };
export type FileEditResult = { path: string; contentFingerprint?: string };
