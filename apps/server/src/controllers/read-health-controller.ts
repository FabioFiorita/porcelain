import type { ReadEnvironmentService } from '@porcelain/access/services';
import type { ReadHealthResponse } from '@porcelain/contracts/access';

export class ReadHealthController {
  private readonly environment: ReadEnvironmentService;

  constructor(environment: ReadEnvironmentService) {
    this.environment = environment;
  }

  execute(): ReadHealthResponse {
    return { status: 'ok', environmentId: this.environment.execute() };
  }
}
