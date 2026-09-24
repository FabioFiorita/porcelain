import type { ReadOwnerStatusResponse } from '@porcelain/contracts/access';
import type { ReadOwnerStatusService } from '@porcelain/access/services';

export class ReadOwnerStatusController {
  private readonly readOwnerStatusService: ReadOwnerStatusService;

  constructor(readOwnerStatusService: ReadOwnerStatusService) {
    this.readOwnerStatusService = readOwnerStatusService;
  }

  execute(): ReadOwnerStatusResponse {
    return this.readOwnerStatusService.execute();
  }
}
