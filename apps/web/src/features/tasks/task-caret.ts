/** Pixel offset of the caret inside a textarea, for an inline suggestion popover. */
export function textareaCaretOffset(el: HTMLTextAreaElement): { top: number; left: number } {
  const style = getComputedStyle(el)
  const mirror = document.createElement('div')
  const properties = [
    'boxSizing',
    'width',
    'height',
    'overflowX',
    'overflowY',
    'borderTopWidth',
    'borderRightWidth',
    'borderBottomWidth',
    'borderLeftWidth',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'fontStyle',
    'fontVariant',
    'fontWeight',
    'fontStretch',
    'fontSize',
    'fontFamily',
    'lineHeight',
    'letterSpacing',
    'textTransform',
    'wordSpacing',
    'textIndent',
    'whiteSpace',
    'wordWrap',
  ] as const
  for (const property of properties) {
    const kebab = property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
    mirror.style.setProperty(kebab, style.getPropertyValue(kebab))
  }
  mirror.style.position = 'absolute'
  mirror.style.visibility = 'hidden'
  mirror.style.whiteSpace = 'pre-wrap'
  mirror.style.wordWrap = 'break-word'
  mirror.style.top = '0'
  mirror.style.left = '0'
  const before = el.value.slice(0, el.selectionStart)
  const marker = document.createElement('span')
  marker.textContent = el.value.slice(el.selectionStart) || '.'
  mirror.textContent = before
  mirror.append(marker)
  el.parentElement?.append(mirror)
  const top = marker.offsetTop - el.scrollTop
  const left = marker.offsetLeft - el.scrollLeft
  mirror.remove()
  return { top, left }
}
