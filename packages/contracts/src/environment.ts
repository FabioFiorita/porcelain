import { z } from 'zod'

/** The route classes used when an environment group chooses a preferred path. */
const endpointKinds = ['tailnet', 'lan', 'other'] as const
export const endpointKindSchema = z.enum(endpointKinds)
export type EndpointKind = (typeof endpointKinds)[number]

/** The smallest shared view needed to order a group's connection endpoints. */
type EndpointGroupLike = {
  url: string
  endpoints?: readonly string[]
  preferredKind?: EndpointKind
}

/** Classify an address without guessing from a hostname. */
export function endpointKind(url: string): EndpointKind {
  let host: string
  try {
    host = new URL(url).hostname
  } catch {
    return 'other'
  }

  const octets = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/.exec(host)
  if (octets === null) return 'other'

  const [first, second] = [Number(octets[1]), Number(octets[2])]
  if (first === 100 && second >= 64 && second <= 127) return 'tailnet'
  if (first === 10) return 'lan'
  if (first === 172 && second >= 16 && second <= 31) return 'lan'
  if (first === 192 && second === 168) return 'lan'
  return 'other'
}

/** Every known endpoint, falling back to the group's last-known-good URL. */
function endpointUrlsOf(group: EndpointGroupLike): string[] {
  const stored = group.endpoints ?? []
  return stored.length > 0 ? [...stored] : [group.url]
}

/**
 * The sequential order used by both clients. A preferred route class wins first,
 * then the last-known-good endpoint, then the group's remaining endpoints.
 */
export function orderedEndpointUrls(group: EndpointGroupLike): string[] {
  const all = endpointUrlsOf(group)
  const preferred =
    group.preferredKind === undefined
      ? []
      : all.filter((url) => endpointKind(url) === group.preferredKind)
  return [...new Set([...preferred, group.url, ...all])].filter((url) => all.includes(url))
}
