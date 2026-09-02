import { z } from 'zod'

export const wslReadinessIssueSchema = z.enum([
  'unsupported-version',
  'probe-failed',
  'node-missing',
  'node-too-old',
  'npx-missing',
  'git-missing',
])
export type WslReadinessIssue = z.infer<typeof wslReadinessIssueSchema>

export const wslManagedStateSchema = z.enum(['available', 'starting', 'online', 'error'])
export type WslManagedState = z.infer<typeof wslManagedStateSchema>

/** A Windows-shell discovery result. It is a candidate Environment, not a Windows path. */
export const wslDistributionSchema = z.object({
  name: z.string().min(1),
  version: z.union([z.literal(1), z.literal(2)]),
  isDefault: z.boolean(),
  nodeVersion: z.string().nullable(),
  gitVersion: z.string().nullable(),
  ready: z.boolean(),
  issues: z.array(wslReadinessIssueSchema),
  managedState: wslManagedStateSchema,
  environmentId: z.string().nullable(),
  managementError: z.string().nullable(),
})
export type WslDistribution = z.infer<typeof wslDistributionSchema>

/** The route classes used when an environment group fails over between connections. */
const endpointKinds = ['tailnet', 'lan', 'other'] as const
export const endpointKindSchema = z.enum(endpointKinds)
export type EndpointKind = (typeof endpointKinds)[number]

/** The smallest shared view needed to order a group's connection endpoints. */
type EndpointGroupLike = {
  url: string
  endpoints?: readonly string[]
  preferredEndpoint?: string
}

const KIND_ORDER: Record<EndpointKind, number> = { lan: 0, tailnet: 1, other: 2 }

/** Classify an address for display. Failover order is derived from this, not stored. */
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

  // HTTP MagicDNS is the direct tailnet listener. Quick Cloudflare tunnels and
  // leftover HTTPS names stay `other` so failover walks LAN → Tailscale → public.
  if (parsed.protocol === 'http:' && host.endsWith('.ts.net')) return 'tailnet'
  return 'other'
}

/** Quick Cloudflare Tunnel hostnames (`*.trycloudflare.com` / `*.cfargotunnel.com`). */
export function isCloudflareEndpoint(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return host.endsWith('.trycloudflare.com') || host.endsWith('.cfargotunnel.com')
  } catch {
    return false
  }
}

/** Every known endpoint, falling back to the group's last-known-good URL. */
function endpointUrlsOf(group: EndpointGroupLike): string[] {
  const stored = group.endpoints ?? []
  return stored.length > 0 ? [...stored] : [group.url]
}

/**
 * Failover order for a group: LAN, then Tailscale, then everything else (Cloudflare
 * and leftover public HTTPS). Preference is not consulted — the kinds already encode
 * the product order, and a stored preference would put a slower public route first.
 */
export function orderedEndpointUrls(group: EndpointGroupLike): string[] {
  const all = [...new Set(endpointUrlsOf(group))]
  return all.sort((left, right) => KIND_ORDER[endpointKind(left)] - KIND_ORDER[endpointKind(right)])
}
