import type { ReadEnvironmentService } from '@porcelain/access/services';
import type { HealthResponse } from '@porcelain/contracts/access';

export class ReadHealthController {
  private readonly environment: ReadEnvironmentService;

  constructor(environment: ReadEnvironmentService) {
    this.environment = environment;
  }

  execute(): HealthResponse {
    return { status: 'ok', environmentId: this.environment.execute() };
  }
}
