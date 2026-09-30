import type { Clock } from '@porcelain/kernel/ports';
import { TooManyPairingAttemptsError } from '../errors/too-many-pairing-attempts-error.ts';

import type {
  TakePairingAttemptInput,
  TakePairingAttemptOptions,
} from '../models/take-pairing-attempt.ts';
import type { PairingAttemptBudgets } from '../models/pairing-attempts.ts';
import type { PairingAttemptStore } from '../ports/pairing-attempt-store.ts';
import { takePairingAttempt } from '../rules/pairing-attempts.ts';

export class TakePairingAttemptService {
  private readonly pairingAttempts: PairingAttemptBudgets<PairingAttemptStore>;
  private readonly clock: Clock;
  private readonly options: TakePairingAttemptOptions;

  constructor(
    pairingAttempts: PairingAttemptBudgets<PairingAttemptStore>,
    clock: Clock,
    options: TakePairingAttemptOptions,
  ) {
    this.pairingAttempts = pairingAttempts;
    this.clock = clock;
    this.options = options;
  }

  execute(input: TakePairingAttemptInput): void {
    const budget = input.crossOrigin ? 'crossOrigin' : 'sameOrigin';
    const store = this.pairingAttempts[budget];
    const { attempts, taken } = takePairingAttempt(
      store.read(),
      input.peer,
      this.clock.now(),
      this.options[budget],
    );
    store.save(attempts);
    if (!taken) throw new TooManyPairingAttemptsError();
  }
}
