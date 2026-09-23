import { GitError } from '../../shared/errors/git-error.ts';

export class InspectionLimitError extends GitError {
  override readonly name = 'InspectionLimitError';

  constructor(options?: ErrorOptions) {
    super('Git inspection exceeds its limit', options);
  }
}
