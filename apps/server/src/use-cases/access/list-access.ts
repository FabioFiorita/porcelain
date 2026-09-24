import type { ListAccessService } from '@porcelain/access/services';
import type { ListAccessResponse } from '@porcelain/contracts/access';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

const ACCESS_LANE = 'access';

export class ListAccessUseCase {
  private readonly listAccess: ListAccessService;
  private readonly lanes: Lanes;

  constructor(listAccess: ListAccessService, lanes: Lanes) {
    this.listAccess = listAccess;
    this.lanes = lanes;
  }

  execute(context: OperationContext): Promise<ListAccessResponse> {
    return this.lanes.run(
      ACCESS_LANE,
      'read',
      async () => this.listAccess.execute(),
      { callerSignal: context.signal },
    );
  }
}
