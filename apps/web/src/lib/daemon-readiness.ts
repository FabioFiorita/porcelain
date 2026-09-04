/** Poll a daemon after a host-side restart without assuming its supervisor or operating system. */
export async function waitForDaemonReady<T>(
  read: () => Promise<T>,
  options: {
    attempts?: number
    delay?: (milliseconds: number) => Promise<void>
  } = {},
): Promise<T> {
  const attempts = options.attempts ?? 40
  const delay =
    options.delay ??
    ((milliseconds) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)))
  let lastError: unknown
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await read()
    } catch (error) {
      lastError = error
      if (attempt + 1 < attempts) await delay(500)
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('The daemon did not become ready after restarting.')
}
