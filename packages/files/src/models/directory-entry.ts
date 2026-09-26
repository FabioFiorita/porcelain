export type EntryKind =
  | 'file'
  | 'directory'
  | 'symlink'
  | 'submodule'
  | 'other';

export type DirectoryEntry = {
  name: string;
  kind: EntryKind;
  ignored?: boolean | undefined;
  target?: string | undefined;
};
