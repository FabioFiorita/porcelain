export function connectionErrorMessage(error: unknown) {
  return error instanceof Error &&
    (error.name === 'ConnectionError' || error.name === 'RequestError')
    ? error.message
    : 'Could not connect to the environment. Try again.';
}
