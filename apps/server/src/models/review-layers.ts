export type ReviewLayer = {
  id: string;
  title: string;
  files: { path: string; scope: 'staged' | 'unstaged' }[];
};
export type ReviewLayers = {
  worktreeId: string;
  revision: number;
  layers: ReviewLayer[];
};
