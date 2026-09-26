export function fileErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'This file could not be loaded. Try again.';
}
