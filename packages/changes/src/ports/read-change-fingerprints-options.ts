import { Context } from 'effect';
import type { ReadChangeFingerprintsOptions as ReadChangeFingerprintsOptionsShape } from '../models/read-change-fingerprints.ts';
export const ReadChangeFingerprintsOptions = Context.Service<
  '@porcelain/changes/ReadChangeFingerprintsOptions',
  ReadChangeFingerprintsOptionsShape
>('@porcelain/changes/ReadChangeFingerprintsOptions');
