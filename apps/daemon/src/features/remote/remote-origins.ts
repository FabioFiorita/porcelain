/**
 * Parse the daemon's explicit browser trust list. CORS must never reflect an arbitrary Origin,
 * and accepting a URL with a path would make the setting look like an endpoint rather than an
 * origin. Keep this helper independent so the standalone startup path and boundary tests share
 * the exact validation rules.
 */
export function parseAllowedOrigins(values: readonly string[]): readonly string[] {
  const origins = values
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter((value) => value !== '')
  const result = new Set<string>()
  for (const origin of origins) {
    let parsed: URL
    try {
      parsed = new URL(origin)
    } catch {
      throw new Error('PORCELAIN_ALLOWED_ORIGIN contains an invalid HTTP(S) origin')
    }
    if (
      (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
      parsed.username !== '' ||
      parsed.password !== '' ||
      parsed.pathname !== '/' ||
      parsed.search !== '' ||
      parsed.hash !== '' ||
      parsed.origin !== origin
    ) {
      throw new Error('PORCELAIN_ALLOWED_ORIGIN contains an invalid HTTP(S) origin')
    }
    result.add(parsed.origin)
  }
  return [...result]
}
