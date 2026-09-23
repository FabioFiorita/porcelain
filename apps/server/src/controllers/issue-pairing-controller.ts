import type {
  IssuePairingRequest,
  IssuePairingResponse,
} from '@porcelain/contracts/access';
import type {
  IssuePairingService,
  ReadEnvironmentService,
} from '@porcelain/access/services';
import type { Lanes } from '../runtime/lanes.ts';
import type { OperationContext } from '../runtime/operation-context.ts';

export class IssuePairingController {
  private readonly readEnvironmentService: ReadEnvironmentService;
  private readonly issuePairingService: IssuePairingService;
  private readonly lanes: Lanes;

  constructor(
    readEnvironmentService: ReadEnvironmentService,
    issuePairingService: IssuePairingService,
    lanes: Lanes,
  ) {
    this.readEnvironmentService = readEnvironmentService;
    this.issuePairingService = issuePairingService;
    this.lanes = lanes;
  }

  execute(
    input: IssuePairingRequest,
    context: OperationContext,
  ): Promise<IssuePairingResponse> {
    return this.lanes.unqueued(
      async () => {
        const { environmentId } = this.readEnvironmentService.execute({});
        const { grants } = this.issuePairingService.execute(input);
        return {
          grants: grants.map(({ grant, code }) => {
            const fragment = new URLSearchParams({ c: code, e: environmentId });
            if (grant.addresses.length > 1)
              fragment.set('a', grant.addresses.join(','));
            return {
              grant,
              code,
              link: `${grant.addresses[0] ?? ''}/pair#${fragment.toString()}`,
            };
          }),
        };
      },
      { callerSignal: context.signal },
    );
  }
}
