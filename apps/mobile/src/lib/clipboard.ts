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
