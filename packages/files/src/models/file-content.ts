export interface FileTarget {
  worktreeId: string;
  root: string;
  path: string;
}

export interface DirectoryListing {
  worktreeId: string;
  path: string;
  entries: {
    name: string;
    kind: 'file' | 'directory' | 'symlink' | 'submodule' | 'other';
    ignored?: boolean;
    target?: string;
  }[];
}

export interface TextContent {
  contentFingerprint?: string;
  worktreeId: string;
  path: string;
  encoding: 'utf-8';
  byteLength: number;
  text: string;
}

export interface FileAsset {
  path: string;
  mediaType: string;
  base64: string;
}

export type PreviewAsset =
  | ({ kind: 'asset' } & FileAsset)
  | { kind: 'unavailable'; path: string };
