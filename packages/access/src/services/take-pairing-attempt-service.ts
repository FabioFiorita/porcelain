import type { Clock } from '@porcelain/kernel/ports';
import { TooManyPairingAttemptsError } from '../errors/too-many-pairing-attempts-error.ts';

import type {
  TakePairingAttemptInput,
  TakePairingAttemptOptions,
} from '../models/take-pairing-attempt.ts';
import type { PairingAttemptStore } from '../ports/pairing-attempt-store.ts';
import { takePairingAttempt } from '../rules/pairing-attempts.ts';

export class TakePairingAttemptService {
  private readonly pairingAttempts: PairingAttemptStore;
  private readonly clock: Clock;
  private readonly options: TakePairingAttemptOptions;

  constructor(
    pairingAttempts: PairingAttemptStore,
    clock: Clock,
    options: TakePairingAttemptOptions,
  ) {
    this.pairingAttempts = pairingAttempts;
    this.clock = clock;
    this.options = options;
  }

  execute(input: TakePairingAttemptInput): void {
    const { attempts, taken } = takePairingAttempt(
      this.pairingAttempts.read(),
      input.peer,
      this.clock.now(),
      this.options,
    );
    this.pairingAttempts.save(attempts);
    if (!taken) throw new TooManyPairingAttemptsError();
  }
}
