import { Context } from 'effect';
import type { PairingAttempts } from '../models/pairing-attempts.ts';

export interface PairingAttemptStore {
  read(): PairingAttempts;
  save(input: PairingAttempts): void;
}

export const PairingAttemptStore = Context.Service<
  '@porcelain/access/PairingAttemptStore',
  PairingAttemptStore
>('@porcelain/access/PairingAttemptStore');
