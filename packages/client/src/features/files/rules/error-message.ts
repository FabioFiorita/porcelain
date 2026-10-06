export function fileErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'This file could not be loaded. Try again.';
}

export function surfaceErrorMessage(error: unknown) {
  return error instanceof Error && error.name === 'ConnectionError'
    ? error.message
    : 'This review surface could not be loaded. Try again.';
}
