import { z } from 'zod'

/** The route classes used when an environment group chooses a preferred path. */
const endpointKinds = ['tailnet', 'lan', 'other'] as const
export const endpointKindSchema = z.enum(endpointKinds)
export type EndpointKind = (typeof endpointKinds)[number]

/** The smallest shared view needed to order a group's connection endpoints. */
type EndpointGroupLike = {
  url: string
  endpoints?: readonly string[]
  preferredEndpoint?: string
}

/** Classify an address for display; the exact endpoint, not this hint, owns preference. */
export function endpointKind(url: string): EndpointKind {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return 'other'
  }

  const host = parsed.hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.local')) return 'lan'

  const octets = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/.exec(host)
  if (octets !== null) {
    const [first, second] = [Number(octets[1]), Number(octets[2])]
    if (first === 100 && second >= 64 && second <= 127) return 'tailnet'
    if (first === 10) return 'lan'
    if (first === 172 && second >= 16 && second <= 31) return 'lan'
    if (first === 192 && second === 168) return 'lan'
  }

  // MagicDNS names use the same suffix as Funnel URLs. HTTP is the daemon's direct
  // tailnet route; HTTPS remains the public/funnel display hint.
  if (parsed.protocol === 'http:' && host.endsWith('.ts.net')) return 'tailnet'
  return 'other'
}

/** Every known endpoint, falling back to the group's last-known-good URL. */
function endpointUrlsOf(group: EndpointGroupLike): string[] {
  const stored = group.endpoints ?? []
  return stored.length > 0 ? [...stored] : [group.url]
}

/**
 * The sequential order used by both clients. The exact preferred endpoint wins first,
 * then the last-known-good endpoint, then the group's remaining endpoints.
 */
export function orderedEndpointUrls(group: EndpointGroupLike): string[] {
  const all = endpointUrlsOf(group)
  const preferred =
    group.preferredEndpoint !== undefined && all.includes(group.preferredEndpoint)
      ? [group.preferredEndpoint]
      : []
  return [...new Set([...preferred, group.url, ...all])].filter((url) => all.includes(url))
}
