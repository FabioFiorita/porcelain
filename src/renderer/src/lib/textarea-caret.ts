// Measure the on-screen pixel position of a textarea's caret at a given character
// offset. There is no DOM API for this, so we use the classic mirror technique: an
// off-screen <div> that copies every layout-affecting style of the textarea, holds
// the text up to `offset` plus a zero-width marker <span>, and is measured. The
// marker's rect (relative to the textarea's box, adjusted for scroll) is the caret.
//
// Returns VIEWPORT coordinates of the caret's BOTTOM — where a completion popup or a
// rename input should anchor, just below the cursor. The mirror is created and removed
// within the call, so it never lingers in the DOM.

// Styles that affect text wrapping/metrics and must be mirrored exactly. Anything not
// here (colors, cursor) doesn't change where a glyph lands.
const MIRRORED_STYLES = [
  'boxSizing',
  'width',
  'borderLeftWidth',
  'borderRightWidth',
  'borderTopWidth',
  'borderBottomWidth',
  'paddingLeft',
  'paddingRight',
  'paddingTop',
  'paddingBottom',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'fontVariant',
  'letterSpacing',
  'lineHeight',
  'textTransform',
  'textIndent',
  'whiteSpace',
  'wordSpacing',
  'tabSize',
] as const

export interface CaretRect {
  x: number
  y: number
}

export function caretRect(textarea: HTMLTextAreaElement, offset: number): CaretRect {
  const mirror = document.createElement('div')
  const computed = window.getComputedStyle(textarea)

  for (const style of MIRRORED_STYLES) {
    // `computed[style]` is a string on the CSSStyleDeclaration; assigning it back to
    // the mirror's style by the same key reproduces the textarea's text layout.
    mirror.style[style] = computed[style]
  }
  // The editor textarea is `whitespace-pre` with `wrap="off"` — long lines DON'T wrap,
  // they scroll horizontally. Mirror that exactly: `pre` (not `pre-wrap`) so the marker
  // lands at the same x/y the textarea places the caret, and `wordWrap: normal` so words
  // never break. A `pre-wrap` mirror would wrap where the textarea doesn't and drift the
  // caret onto the wrong visual line.
  mirror.style.whiteSpace = 'pre'
  mirror.style.wordWrap = 'normal'
  // Off-screen but laid out so the marker rect is real. `visibility:hidden` (not
  // `display:none`) keeps geometry; `position:absolute` takes it out of flow.
  mirror.style.position = 'absolute'
  mirror.style.visibility = 'hidden'
  mirror.style.top = '0'
  mirror.style.left = '0'
  // Match the textarea's content height behavior; let it grow with the text.
  mirror.style.height = 'auto'
  mirror.style.overflow = 'hidden'

  // The text up to the caret, then a marker we measure. textContent escapes the value,
  // so source code with `<`/`&` can't inject markup.
  mirror.textContent = textarea.value.slice(0, offset)
  const marker = document.createElement('span')
  // A non-empty marker (zero-width space) gets a real bounding rect even at line start.
  marker.textContent = '​'
  mirror.appendChild(marker)

  document.body.appendChild(mirror)
  const markerRect = marker.getBoundingClientRect()
  const mirrorRect = mirror.getBoundingClientRect()
  document.body.removeChild(mirror)

  const textareaRect = textarea.getBoundingClientRect()
  // The marker's position WITHIN the mirror, mapped onto the textarea box and offset
  // by the textarea's own scroll. `y` is the caret's bottom (markerRect.bottom).
  return {
    x: textareaRect.left + (markerRect.left - mirrorRect.left) - textarea.scrollLeft,
    y: textareaRect.top + (markerRect.bottom - mirrorRect.top) - textarea.scrollTop,
  }
}
