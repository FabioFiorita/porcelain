import * as Clipboard from 'expo-clipboard'

/**
 * Put text on the system pasteboard, the mobile half of the web viewer's `copyText`.
 *
 * Resolves to whether it landed rather than throwing: every caller is a menu row whose only
 * honest response to a failure is to say so on screen, and an unhandled rejection from a tap
 * handler would take the surface down instead.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(text)
    return true
  } catch {
    return false
  }
}

/** Whether the system pasteboard currently holds an image (a screenshot, a copied photo). */
export async function hasImage(): Promise<boolean> {
  try {
    return await Clipboard.hasImageAsync()
  } catch {
    return false
  }
}

export type ClipboardImage = { base64: string; mime: 'image/png' }

/**
 * Read the pasteboard's image as PNG. Null when there is none, or the platform refuses
 * (iOS reports an empty pasteboard the same way it reports a denied paste permission —
 * indistinguishable from here, which is fine: both mean "nothing to attach").
 */
export async function getImage(): Promise<ClipboardImage | null> {
  try {
    const image = await Clipboard.getImageAsync({ format: 'png' })
    if (image === null) return null
    const prefix = 'data:image/png;base64,'
    const base64 = image.data.startsWith(prefix) ? image.data.slice(prefix.length) : image.data
    return { base64, mime: 'image/png' }
  } catch {
    return null
  }
}
