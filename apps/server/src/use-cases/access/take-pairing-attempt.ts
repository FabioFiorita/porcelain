import type { TakePairingAttemptInput } from '@porcelain/access/models';
import type { TakePairingAttemptService } from '@porcelain/access/services';

export class TakePairingAttemptUseCase {
  private readonly takePairingAttempt: TakePairingAttemptService;

  constructor(takePairingAttempt: TakePairingAttemptService) {
    this.takePairingAttempt = takePairingAttempt;
  }

  execute(input: TakePairingAttemptInput): void {
    this.takePairingAttempt.execute(input);
  }
}
