import type { PairingAttempts } from '../models/pairing-attempts.ts';

export interface PairingAttemptStore {
  read(): PairingAttempts;
  save(input: PairingAttempts): void;
}
