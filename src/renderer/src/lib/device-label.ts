/**
 * A short "<app> on <os>" name this client volunteers when it redeems a pairing code.
 *
 * Why it exists: since phase 4 the daemon mints a per-device credential and keeps a roster
 * row per paired device. Without a label every row reads "Paired device", so a human
 * revoking access can't tell the iPhone from the laptop. The label is purely advisory
 * DISPLAY data — the daemon sanitizes and caps it and NEVER treats it as an identifier, so
 * a wrong or spoofed value costs readability, nothing more. That's what lets the detection
 * stay this small: a handful of ordered substring checks, no UA-parsing dependency, and a
 * cheerful fallback when the string is unfamiliar.
 */

const FALLBACK = 'Porcelain'

// Ordered: later entries are substrings of earlier ones in real UAs (Electron and Edge both
// carry "Chrome"; every Chromium carries "Safari"), so first match wins.
const APPS: ReadonlyArray<readonly [needle: string, name: string]> = [
  // In the Electron window the app *is* Porcelain — naming the runtime would be noise.
  ['Electron/', 'Porcelain'],
  ['Edg/', 'Edge'],
  ['Firefox/', 'Firefox'],
  ['CriOS/', 'Chrome'],
  ['Chrome/', 'Chrome'],
  ['Safari/', 'Safari'],
]

const SYSTEMS: ReadonlyArray<readonly [needle: string, name: string]> = [
  ['iPhone', 'iPhone'],
  ['iPad', 'iPad'],
  ['Android', 'Android'],
  ['Mac OS X', 'macOS'],
  ['Windows', 'Windows'],
  ['Linux', 'Linux'],
]

const match = (
  ua: string,
  table: ReadonlyArray<readonly [needle: string, name: string]>,
): string | null => table.find(([needle]) => ua.includes(needle))?.[1] ?? null

/** Pure half, so the ordering above is unit-testable without a browser. */
export function describeDevice(userAgent: string): string {
  const app = match(userAgent, APPS)
  const os = match(userAgent, SYSTEMS)
  if (app && os) return `${app} on ${os}`
  return app ?? os ?? FALLBACK
}

/** Reads the live UA; safe to call from the daemon-served browser client and the shell alike. */
export function deviceLabel(): string {
  if (typeof navigator === 'undefined' || typeof navigator.userAgent !== 'string') return FALLBACK
  return describeDevice(navigator.userAgent)
}
