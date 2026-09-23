import {
  gitActionReceiptView,
  type GitActionReceiptView,
} from '@porcelain/git-actions/models';
import type { ReadGitActionReceiptService } from '@porcelain/git-actions/services';
import type { Lanes } from '../runtime/operation-runner.ts';

export class ReadGitActionReceiptController {
  private readonly lanes: Lanes;
  private readonly read: ReadGitActionReceiptService;

  constructor(lanes: Lanes, read: ReadGitActionReceiptService) {
    this.lanes = lanes;
    this.read = read;
  }

  execute(requestId: string): GitActionReceiptView {
    this.lanes.assertOpen();
    return gitActionReceiptView(this.read.execute(requestId));
  }
}
