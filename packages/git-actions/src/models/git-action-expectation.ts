import type { FingerprintedFile } from './fingerprinted-file.ts';

export type UpstreamExpectation = { oid?: string | undefined };

export type GitActionExpectation = {
  headOid?: string | undefined;
  branch?: string | undefined;
  inProgress?: 'merge' | 'rebase' | undefined;
  mergeHeadOid?: string | undefined;
  upstream?: UpstreamExpectation | undefined;
  files?: FingerprintedFile[] | undefined;
};
