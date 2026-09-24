import type { Clock } from '@porcelain/kernel/ports';
import type { PairingAttemptLimits } from '../models/pairing-attempts.ts';
import type { RefundPairingAttemptInput } from '../models/refund-pairing-attempt.ts';
import type { PairingAttemptStore } from '../ports/pairing-attempt-store.ts';
import { refundPairingAttempt } from '../rules/pairing-attempts.ts';

export class RefundPairingAttemptService {
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

  execute(input: RefundPairingAttemptInput): void {
    this.pairingAttempts.save(
      refundPairingAttempt(
        this.pairingAttempts.read(),
        input.peer,
        this.clock.now(),
        this.limits,
      ),
    );
  }
}
