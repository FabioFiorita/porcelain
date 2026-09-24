import type { FileChange } from '@porcelain/kernel/models';

export type ChangeFingerprints = {
  changes: FileChange[];
  stamp: string;
};
