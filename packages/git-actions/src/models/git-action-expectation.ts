import type { ExpectedFile } from './expected-file.ts';

export type UpstreamExpectation = { oid?: string | undefined };

export type GitActionExpectation = {
  headOid?: string | undefined;
  branch?: string | undefined;
  inProgress?: 'merge' | 'rebase' | undefined;
  mergeHeadOid?: string | undefined;
  upstream?: UpstreamExpectation | undefined;
  files?: ExpectedFile[] | undefined;
};
