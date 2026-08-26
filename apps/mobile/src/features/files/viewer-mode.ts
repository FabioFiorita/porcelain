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

import type { LineRange } from '@/features/comments'
import type { HtmlMode, MarkdownMode } from '@/features/settings/preferences-store'

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

/**
 * Which face the viewer is actually showing.
 *
 * `source` is the floor, not a fallback of last resort: a rendered face only exists for a **text**
 * file that has one, so an image, a binary and a file past the read cap all read as source no
 * matter what either preference says.
 */
export type ViewerFace = 'preview' | 'reader' | 'source'

export function viewerFace(file: {
  html: boolean
  htmlMode: HtmlMode
  isText: boolean
  markdown: boolean
  markdownMode: MarkdownMode
}): ViewerFace {
  if (!file.isText) return 'source'
  if (file.markdown && file.markdownMode === 'reader') return 'reader'
  if (file.html && file.htmlMode === 'preview') return 'preview'
  return 'source'
}

/**
 * The range a comment would anchor to, given what is on screen.
 *
 * Source selections belong only to Source. Rendered Markdown supplies its own source-positioned
 * selection through the preview bridge, so callers substitute that range while Reader is active.
 */
export function anchorableRange(selected: LineRange | null, face: ViewerFace): LineRange | null {
  return face === 'source' ? selected : null
}
