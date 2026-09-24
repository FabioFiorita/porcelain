import type { Clock } from '@porcelain/kernel/ports';
import { TooManyPairingAttemptsError } from '../errors/too-many-pairing-attempts-error.ts';
import type { PairingAttemptLimits } from '../models/pairing-attempts.ts';
import type { TakePairingAttemptInput } from '../models/take-pairing-attempt.ts';
import type { PairingAttemptStore } from '../ports/pairing-attempt-store.ts';
import { takePairingAttempt } from '../rules/pairing-attempts.ts';

export class TakePairingAttemptService {
  private readonly pairingAttempts: PairingAttemptStore;
  private readonly clock: Clock;
  private readonly limits: PairingAttemptLimits;

  constructor(
    pairingAttempts: PairingAttemptStore,
    clock: Clock,
    limits: PairingAttemptLimits,
  ) {
    this.pairingAttempts = pairingAttempts;
    this.clock = clock;
    this.limits = limits;
  }

  execute(input: TakePairingAttemptInput): void {
    const { attempts, taken } = takePairingAttempt(
      this.pairingAttempts.read(),
      input.peer,
      this.clock.now(),
      this.limits,
    );
    this.pairingAttempts.save(attempts);
    if (!taken) throw new TooManyPairingAttemptsError();
  }
}
