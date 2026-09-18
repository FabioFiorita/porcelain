type ReviewLayerFile = {
  path: string;
  scope: 'staged' | 'unstaged';
  /** One short, file-specific explanation from the agent. */
  note?: string | undefined;
};

type GuideSource = {
  path: string;
  startLine: number;
  endLine: number;
  contentFingerprint: string;
};

type ReviewGuide = {
  purpose: string;
  steps: {
    id: string;
    title: string;
    question: string;
    source: GuideSource;
    note?: string | undefined;
    verification?: string | undefined;
    related?: { title: string; source: GuideSource }[] | undefined;
  }[];
};

export type ReviewLayer = {
  id: string;
  title: string;
  /** Markdown explanation of the layer's intent. */
  summary?: string | undefined;
  files: ReviewLayerFile[];
  guide?: ReviewGuide | undefined;
};
export type ReviewLayers = {
  worktreeId: string;
  revision: number;
  layers: ReviewLayer[];
};
