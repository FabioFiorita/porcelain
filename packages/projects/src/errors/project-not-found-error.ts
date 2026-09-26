export class ProjectNotFoundError extends Error {
  override readonly name = 'ProjectNotFoundError';

  constructor() {
    super('Project not found');
  }
}
