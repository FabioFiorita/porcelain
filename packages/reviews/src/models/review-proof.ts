export type ProofTarget = {
  layerId?: string | undefined;
  stepId?: string | undefined;
};

type ProofCheck = ProofTarget & {
  name: string;
  result: 'pass' | 'fail' | 'skipped';
  output?: string | undefined;
};

export type ProofFileKind = 'image' | 'video';

export type ProofMediaType =
  | 'image/png'
  | 'image/jpeg'
  | 'image/gif'
  | 'image/webp'
  | 'video/mp4'
  | 'video/webm';

export type ProofFileDraft = ProofTarget & {
  kind: ProofFileKind;
  title: string;
  path?: string | undefined;
  proofId?: string | undefined;
};

type ProofLinkDraft = ProofTarget & {
  kind: 'link';
  title: string;
  url: string;
};

type ProofAssetDraft = ProofFileDraft | ProofLinkDraft;

export type ProofDraft = {
  checks?: readonly ProofCheck[] | undefined;
  assets?: readonly ProofAssetDraft[] | undefined;
};

type ProofFileAsset = ProofTarget & {
  id: string;
  kind: ProofFileKind;
  title: string;
  mediaType: ProofMediaType;
  byteLength: number;
};

type ProofLinkAsset = ProofLinkDraft & { id: string };

export type ProofAsset = ProofFileAsset | ProofLinkAsset;

export type ReviewProof = {
  checks: readonly ProofCheck[];
  assets: readonly ProofAsset[];
  baseline?: ProofBaseline | undefined;
};

type ProofBaseline = {
  digest: string;
  proofPaths: readonly string[];
};

export type ResolvedProof = {
  checks: readonly ProofCheck[];
  assets: readonly ProofAsset[];
  current: boolean;
};

export type ProofFile = {
  id: string;
  mediaType: ProofMediaType;
  bytes: Uint8Array;
};

export type ProofFileKey = {
  worktreeId: string;
  proofId: string;
};

export type ProofFileReads = {
  files: ReadonlyMap<string, Uint8Array>;
  tooLarge: readonly string[];
};

export type ProofLimits = {
  totalBytes: number;
  signatureBytes: number;
};
