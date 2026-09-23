export class GitBranchListingUnavailableError extends Error {
  constructor() {
    super('Branch listing is unavailable');
  }
}
