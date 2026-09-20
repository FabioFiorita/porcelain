/**
 * One project took longer than its share of a listing.
 *
 * This is data, not a fault: the project is reported unavailable with its
 * last-known worktrees, exactly like a repository that cannot be read, and the
 * other projects answer. A repository on a mount that has stopped responding is
 * the case this exists for — Git's own deadline is far longer than anyone is
 * willing to wait for a sidebar.
 */
export class ProjectListingTimeoutError extends Error {
  override readonly name = 'ProjectListingTimeoutError';

  constructor() {
    super('The project took too long to list');
  }
}
