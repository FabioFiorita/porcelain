import type { ExpectedFile } from '@porcelain/kernel/models';

export type FingerprintedFile = ExpectedFile & { fingerprint: string };
