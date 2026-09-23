export class GitBranchListingUnavailableError extends Error {
  override readonly name = 'GitBranchListingUnavailableError';

  constructor() {
    super('Branch listing is unavailable');
  }
}
