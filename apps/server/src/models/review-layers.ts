type ReviewLayerFile = {
  path: string;
  scope: 'staged' | 'unstaged';
  /** One short, file-specific explanation from the agent. */
  note?: string | undefined;
};

export type ReviewLayer = {
  id: string;
  title: string;
  /** Markdown explanation of the layer's intent. */
  summary?: string | undefined;
  files: ReviewLayerFile[];
};
export type ReviewLayers = {
  worktreeId: string;
  revision: number;
  layers: ReviewLayer[];
};
