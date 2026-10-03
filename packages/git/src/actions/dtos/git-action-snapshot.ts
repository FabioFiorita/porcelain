import type { GitActionPreview } from './git-action.ts';

export type ActionRemote = {
  name: string;
  url: string;
  trackingRef: string;
  display: string;
};

export type GitActionSnapshot = {
  preview: GitActionPreview;
  remote?: ActionRemote;
  stashLog: string;
};
