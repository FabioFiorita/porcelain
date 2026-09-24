import type { ReadOwnerStatusService } from '@porcelain/access/services';
import type { ReadOwnerStatusResponse } from '@porcelain/contracts/access';

export class ReadOwnerStatusUseCase {
  private readonly readOwnerStatus: ReadOwnerStatusService;

  constructor(readOwnerStatus: ReadOwnerStatusService) {
    this.readOwnerStatus = readOwnerStatus;
  }

  execute(): ReadOwnerStatusResponse {
    return this.readOwnerStatus.execute();
  }
}
