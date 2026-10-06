import { GitError } from './git-error.ts';

export class InspectionLimitError extends GitError {
  override readonly name = 'InspectionLimitError';

  constructor(options?: ErrorOptions) {
    super('Git inspection exceeds its limit', options);
  }
}
