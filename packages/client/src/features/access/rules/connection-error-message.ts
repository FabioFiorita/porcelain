export const UNSAVED_DRAFTS_MESSAGE =
  'Save or discard unsaved file drafts before disconnecting.';

export function connectionErrorMessage(error: unknown) {
  return error instanceof Error &&
    (error.name === 'ConnectionError' ||
      error.name === 'RequestError' ||
      '_tag' in error)
    ? error.message
    : 'Could not connect to the environment. Try again.';
}
