const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

/** True only for web/mail URLs safe to hand to the OS opener. */
export function isSafeExternalUrl(url: string): boolean {
  try {
    return ALLOWED_PROTOCOLS.has(new URL(url).protocol)
  } catch {
    return false
  }
}
