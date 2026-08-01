import { font, foregroundStyle } from '@expo/ui/swift-ui/modifiers'

/**
 * The text modifiers more than one screen wears. A modifier is a plain config object, so these
 * are built once at module load and shared — a screen that re-declares one is how two surfaces
 * drift into two greys.
 */
export const secondary = foregroundStyle({ style: 'secondary', type: 'hierarchical' })
export const footnote = font({ textStyle: 'footnote' })

/** Diff and hash text. Fixed size, not a text style: a diff line that scales with Dynamic Type
 *  re-wraps the gutter, and the whole point of the gutter is that it lines up. */
export const monospace = font({ design: 'monospaced', size: 12 })
