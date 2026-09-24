import type { PairingAttempts } from '@porcelain/access/models';
import type { PairingAttemptStore } from '@porcelain/access/ports';

export class InMemoryPairingAttemptStore implements PairingAttemptStore {
  private attempts: PairingAttempts = { shared: undefined, peers: new Map() };

  read(): PairingAttempts {
    return this.attempts;
  }

  save(input: PairingAttempts): void {
    this.attempts = input;
  }
}
