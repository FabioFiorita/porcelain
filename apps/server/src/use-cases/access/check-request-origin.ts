import type { CheckRequestOriginInput } from '@porcelain/access/models';
import { requestOriginCheck } from '@porcelain/access/rules';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export type RequestOriginVerdict =
  | { allowed: true }
  | { allowed: false; reason: string };

export class CheckRequestOriginUseCase {
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(lanes: Lanes, laneKeys: LaneKeys) {
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(
    input: CheckRequestOriginInput,
    context: OperationContext,
  ): Promise<RequestOriginVerdict> {
    return this.lanes.run(
      this.laneKeys.access(),
      'read',
      async (): Promise<RequestOriginVerdict> => {
        const result = requestOriginCheck(input);
        return result.kind === 'allowed'
          ? { allowed: true }
          : { allowed: false, reason: result.reason };
      },
      { callerSignal: context.signal },
    );
  }
}
