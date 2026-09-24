import type { ReadHealthResponse } from '@porcelain/contracts/access';
import type { ReadEnvironmentService } from '@porcelain/access/services';

export class ReadHealthController {
  private readonly readEnvironmentService: ReadEnvironmentService;

  constructor(readEnvironmentService: ReadEnvironmentService) {
    this.readEnvironmentService = readEnvironmentService;
  }

  execute(): ReadHealthResponse {
    const { environmentId } = this.readEnvironmentService.execute();
    return { status: 'ok', environmentId };
  }
}
