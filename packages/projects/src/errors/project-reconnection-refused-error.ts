import { Schema } from 'effect';

export class ProjectReconnectionRefusedError extends Schema.TaggedError<ProjectReconnectionRefusedError>()(
  'ProjectReconnectionRefusedError',
  { message: Schema.String },
) {}
