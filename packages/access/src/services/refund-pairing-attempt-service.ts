import type { Clock } from '@porcelain/kernel/ports';

import type {
  RefundPairingAttemptInput,
  RefundPairingAttemptOptions,
} from '../models/refund-pairing-attempt.ts';
import type { PairingAttemptStore } from '../ports/pairing-attempt-store.ts';
import { refundPairingAttempt } from '../rules/pairing-attempts.ts';

export class RefundPairingAttemptService {
  private readonly pairingAttempts: PairingAttemptStore;
  private readonly clock: Clock;
  private readonly options: RefundPairingAttemptOptions;

  constructor(
    pairingAttempts: PairingAttemptStore,
    clock: Clock,
    options: RefundPairingAttemptOptions,
  ) {
    this.pairingAttempts = pairingAttempts;
    this.clock = clock;
    this.options = options;
  }

  execute(input: RefundPairingAttemptInput): void {
    this.pairingAttempts.save(
      refundPairingAttempt(
        this.pairingAttempts.read(),
        input.peer,
        this.clock.now(),
        this.options,
      ),
    );
  }
}
