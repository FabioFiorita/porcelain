import type {
  CheckRequestOriginInput,
  CheckRequestOriginResult,
} from '@porcelain/access/models';
import type { CheckRequestOriginService } from '@porcelain/access/services';
import type { OperationContext } from '../runtime/operation-context.ts';

export class CheckRequestOriginController {
  private readonly checkRequestOriginService: CheckRequestOriginService;

  constructor(checkRequestOriginService: CheckRequestOriginService) {
    this.checkRequestOriginService = checkRequestOriginService;
  }

  execute(
    input: CheckRequestOriginInput,
    context: OperationContext,
  ): CheckRequestOriginResult {
    context.signal?.throwIfAborted();
    return this.checkRequestOriginService.execute(input);
  }
}
