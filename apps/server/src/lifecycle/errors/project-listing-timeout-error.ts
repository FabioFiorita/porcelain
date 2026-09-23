export class ProjectListingTimeoutError extends Error {
  override readonly name = 'ProjectListingTimeoutError';

  constructor() {
    super('The project took too long to list');
  }
}
