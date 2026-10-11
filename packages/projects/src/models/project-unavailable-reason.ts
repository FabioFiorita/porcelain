import { Schema } from 'effect';

export const projectUnavailableReasonSchema = Schema.Literals([
  'moved',
  'missing',
  'permission',
  'git-failed',
]);
export type ProjectUnavailableReason =
  typeof projectUnavailableReasonSchema.Type;
