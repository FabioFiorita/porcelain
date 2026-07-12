import type { AgentImage } from '@shared/agent-protocol'

/**
 * Downscale an image (given as a data URL) to a small thumbnail for the persisted timeline.
 * The daemon has no canvas, so the renderer does this before send: the full-size image still
 * goes to the CLI, while the thumbnail is what gets stored on the `user` timeline item (see
 * agent-protocol) so reopening a thread shows what was sent without persisting megabytes.
 *
 * Draws to an offscreen canvas, longest edge clamped to `maxEdge` (never upscales), and
 * re-encodes as JPEG at `quality`. Returns the `{ mediaType, base64 }` the protocol wants, or
 * null if the image can't be decoded (a broken/unsupported file) — the caller then just omits
 * a thumbnail for that attachment (its `imageCount` still reflects it).
 */
export function makeThumbnail(
  dataUrl: string,
  maxEdge = 256,
  quality = 0.7,
): Promise<AgentImage | null> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => {
      const longest = Math.max(image.width, image.height)
      const scale = longest > maxEdge ? maxEdge / longest : 1
      const width = Math.max(1, Math.round(image.width * scale))
      const height = Math.max(1, Math.round(image.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(null)
        return
      }
      ctx.drawImage(image, 0, 0, width, height)
      const encoded = canvas.toDataURL('image/jpeg', quality)
      const base64 = encoded.split(',')[1] ?? ''
      resolve(base64 === '' ? null : { mediaType: 'image/jpeg', base64 })
    }
    image.onerror = () => resolve(null)
    image.src = dataUrl
  })
}
