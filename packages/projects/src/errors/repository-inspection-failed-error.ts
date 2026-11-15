import { Schema } from 'effect';

export class RepositoryInspectionFailedError extends Schema.TaggedError<RepositoryInspectionFailedError>()(
  'RepositoryInspectionFailedError',
  { message: Schema.String },
) {}
