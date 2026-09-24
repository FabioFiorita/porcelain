import type { RefundPairingAttemptInput } from '@porcelain/access/models';
import type { RefundPairingAttemptService } from '@porcelain/access/services';

export class RefundPairingAttemptUseCase {
  private readonly refundPairingAttempt: RefundPairingAttemptService;

  constructor(refundPairingAttempt: RefundPairingAttemptService) {
    this.refundPairingAttempt = refundPairingAttempt;
  }

  execute(input: RefundPairingAttemptInput): void {
    this.refundPairingAttempt.execute(input);
  }
}
