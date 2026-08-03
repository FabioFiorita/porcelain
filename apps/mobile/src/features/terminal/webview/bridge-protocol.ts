import { z } from 'zod'

const webViewMessageSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('ready') }),
  z.object({ t: z.literal('input'), data: z.string() }),
  z.object({ t: z.literal('resize'), cols: z.number().int(), rows: z.number().int() }),
  z.object({ t: z.literal('cursor-mode'), application: z.boolean() }),
  z.object({ t: z.literal('focus'), focused: z.boolean() }),
  z.object({ t: z.literal('link'), url: z.string() }),
])

export type TerminalWebViewMessage = z.infer<typeof webViewMessageSchema>

export function parseBridgeMessage(raw: string): TerminalWebViewMessage | null {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  const parsed = webViewMessageSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export function isSafeExternalUrl(url: string): boolean {
  try {
    const protocol = new URL(url).protocol
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

/** JSON script literals need the two Unicode line separators escaped as well. */
export function javascriptString(value: string): string {
  return JSON.stringify(value)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}
