import type { GitActionPreview } from '../dtos/git-action.ts';

export type GitActionSnapshot = {
  fingerprint: string;
  preview: GitActionPreview;
  remote?: { name: string; url: string; trackingRef: string };
  stashLog: string;
};
