function errorType(error: unknown): string {
  const cause = error instanceof Error && error.cause !== undefined ? error.cause : error
  if (cause instanceof Error) {
    // Class identity only. Never the settable `name`/`message`/`stack` —
    // those are runtime strings and can carry payload data.
    const className = cause.constructor.name
    return className === '' ? 'Error' : className
  }
  return typeof cause
}

export function logUnexpectedError({
  error,
  requestId,
  path,
}: {
  error: unknown
  requestId: string
  path: string | undefined
}): void {
  console.error({ requestId, path: path ?? null, errorType: errorType(error) })
}
