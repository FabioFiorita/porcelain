import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Our custom sub-xs font-size tokens (main.css @theme: text-4xs … text-sm-minus)
// share the `text-` prefix with color utilities. Plain tailwind-merge reads the
// hyphenated ones (text-sm-minus, text-xs-minus, text-xs-plus, text-2xs-plus) as
// color names and DROPS them when an element also carries a text-color — e.g.
// cn('… text-sm-minus', 'text-foreground') would silently lose the size. Register
// the whole custom scale as font sizes so both classes survive the merge.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['4xs', '3xs', '2xs', '2xs-plus', 'xs-minus', 'xs-plus', 'sm-minus'] }],
    },
  },
})

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

// The tailnet browser client (Phase 3 remote envs) is served over plain HTTP on a
// non-localhost origin — WireGuard encrypts the wire, so there's no TLS by design.
// That makes it an INSECURE browser context, where secure-context-only APIs like
// crypto.randomUUID and navigator.clipboard simply DON'T EXIST. localhost + Electron
// are secure contexts, which is why this never bites there. Rule of thumb: never call
// a secure-context API directly in the renderer — go through these helpers.

// crypto.getRandomValues IS available in insecure contexts (unlike randomUUID), so
// it's the fallback primitive: build a v4 UUID from 16 random bytes by hand.
export function randomId(cryptoObj: Crypto = crypto): string {
  if (typeof cryptoObj.randomUUID === 'function') return cryptoObj.randomUUID()
  const bytes = cryptoObj.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant 10xx
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

// navigator.clipboard is absent in insecure contexts; fall back to the deprecated
// textarea + execCommand('copy') dance (the only option there).
export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}
