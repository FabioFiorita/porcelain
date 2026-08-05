/**
 * Which face a file opens in — and who gets to decide.
 *
 * Settings holds the **default**: "reader" for markdown, "preview" for HTML. The toggle above
 * the viewer is an **override for the file on screen**, not a second way to edit that default.
 * The two used to be the same field, so one tap on "Source" to glance at a README's raw text
 * silently redefined the app-wide default and wrote it to SecureStore — every markdown file
 * opened afterwards inherited that glance, and nothing ever put "Reader" back.
 *
 * Scoped to the path rather than to the viewer's lifetime because the two hosts have different
 * lifetimes for the same surface: the phone pushes a route per file (a fresh viewer each time)
 * while the tablet's column keeps one viewer and swaps the path underneath it. Keying on the
 * path makes both do the one honest thing — the override belongs to the file you flipped, and
 * the next file you open reads the default again.
 */

/** A mode chosen for one specific file, by the reader, for as long as that file is open. */
export type ViewerOverride<TMode extends string> = {
  /** Repo-relative path the choice was made on. */
  path: string
  mode: TMode
}

/** The override when it belongs to this file, the Settings default otherwise. */
export function viewerMode<TMode extends string>(
  fallback: TMode,
  override: ViewerOverride<TMode> | null,
  path: string,
): TMode {
  return override !== null && override.path === path ? override.mode : fallback
}
