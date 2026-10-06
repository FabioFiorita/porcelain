import { Schema } from 'effect';

export class ProjectNotFoundError extends Schema.TaggedError<ProjectNotFoundError>()(
  'ProjectNotFoundError',
  {},
) {
  override get message() {
    return 'Project not found';
  }
}
