export function surfaceErrorMessage(error: unknown) {
  return error instanceof Error && error.name === 'ConnectionError'
    ? error.message
    : 'This review surface could not be loaded. Try again.';
}
