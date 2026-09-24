import type {
  CheckRequestOriginInput,
  CheckRequestOriginResult,
} from '@porcelain/access/models';
import type { CheckRequestOriginService } from '@porcelain/access/services';

export class CheckRequestOriginController {
  private readonly checkRequestOriginService: CheckRequestOriginService;

  constructor(checkRequestOriginService: CheckRequestOriginService) {
    this.checkRequestOriginService = checkRequestOriginService;
  }

  execute(input: CheckRequestOriginInput): CheckRequestOriginResult {
    return this.checkRequestOriginService.execute(input);
  }
}
