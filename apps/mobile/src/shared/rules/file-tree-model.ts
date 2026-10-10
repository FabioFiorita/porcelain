export type FileTreeNode = {
  id: string;
  name: string;
  kind: 'file' | 'folder' | 'code' | 'image';
  status?: string;
  children?: readonly FileTreeNode[];
};
