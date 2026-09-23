import type {
  ReadGitActionReceiptParams,
  ReadGitActionReceiptResponse,
} from '@porcelain/contracts/git-actions';
import type { ReadGitActionReceiptService } from '@porcelain/git-actions/services';
import type { Lanes } from '../runtime/lanes.ts';
import type { OperationContext } from '../runtime/operation-context.ts';

export class ReadGitActionReceiptController {
  private readonly readGitActionReceipt: ReadGitActionReceiptService;
  private readonly lanes: Lanes;

  constructor(readGitActionReceipt: ReadGitActionReceiptService, lanes: Lanes) {
    this.readGitActionReceipt = readGitActionReceipt;
    this.lanes = lanes;
  }

  execute(
    input: ReadGitActionReceiptParams,
    context: OperationContext,
  ): ReadGitActionReceiptResponse {
    context.signal?.throwIfAborted();
    this.lanes.assertOpen();
    return this.readGitActionReceipt.execute({ requestId: input.requestId });
  }
}
