import type { ReadEnvironmentService } from '@porcelain/access/services';
import type { ReadHealthResponse } from '@porcelain/contracts/access';

export class ReadHealthUseCase {
  private readonly readEnvironment: ReadEnvironmentService;

  constructor(readEnvironment: ReadEnvironmentService) {
    this.readEnvironment = readEnvironment;
  }

  execute(): ReadHealthResponse {
    const { environmentId } = this.readEnvironment.execute();
    return { status: 'ok', environmentId };
  }
}
