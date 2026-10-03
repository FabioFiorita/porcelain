import type { PairingAttempts } from '../../src/models/pairing-attempts.ts';
import type { PairingAttemptStore } from '../../src/ports/pairing-attempt-store.ts';

export class InMemoryPairingAttemptStore implements PairingAttemptStore {
  private attempts: PairingAttempts = { shared: undefined, peers: new Map() };

  read(): PairingAttempts {
    return this.attempts;
  }

  save(input: PairingAttempts): void {
    this.attempts = input;
  }
}
