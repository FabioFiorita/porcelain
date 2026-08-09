function errorType(error: unknown): string {
  const cause = error instanceof Error && error.cause !== undefined ? error.cause : error
  if (cause instanceof Error) return 'Error'
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
