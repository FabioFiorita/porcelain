export type CommitModel = { id: string; label: string };
export type CommitGroup = { message: string; paths: string[] };
export type CommitDraftInput = {
  mode: 'message' | 'groups';
  model: string;
  expectedStatusToken: string;
  paths: string[];
};
export type CommitDraft = {
  groups: CommitGroup[];
  expectedFiles: { path: string; fingerprint: string }[];
};
export type CommitDraftCapture = {
  paths: string[];
  bundles: string[][];
  prompt: string;
  expectedFiles: CommitDraft['expectedFiles'];
};
