/** Format a byte count for human-facing over-cap copy (always MB, one decimal). */
export function formatEvidenceMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Over-cap copy for an Evidence descriptor the daemon declined to inline. The
 * descriptor still carries the file's real size, so the message names a concrete
 * number rather than "unavailable" — the bytes exist on disk, they were just too
 * large for the read cap.
 */
export function evidenceOverCapMessage(descriptor: { bytes: number; maxBytes: number }): string {
  return `Too large to preview (${formatEvidenceMb(descriptor.bytes)} > ${formatEvidenceMb(descriptor.maxBytes)})`
}
