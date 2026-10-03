import type { ProofMediaType } from './review-proof.ts';

export type ReadProofFileInput = {
  worktreeId: string;
  proofId: string;
};

export type ReadProofFileResult = {
  id: string;
  mediaType: ProofMediaType;
  base64: string;
};

export type ReadProofFileOptions = {
  base64ChunkBytes: number;
};
