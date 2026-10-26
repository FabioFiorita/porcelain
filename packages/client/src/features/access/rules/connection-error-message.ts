import { Predicate } from 'effect';
export const UNSAVED_DRAFTS_MESSAGE =
  'Save or discard unsaved file drafts before disconnecting.';

export function connectionErrorMessage(error: unknown) {
  return error instanceof Error &&
    (error.name === 'ConnectionError' ||
      error.name === 'RequestError' ||
      Predicate.hasProperty(error, '_tag'))
    ? error.message
    : 'Could not connect to the environment. Try again.';
}
