import { z } from 'zod'
import { protocolHeaders } from './daemon-headers'
import { normalizeDaemonUrl } from './remote-daemon'

/**
 * Redeeming a Porcelain connection link.
 *
 * Extracted from `shell-api.ts` so the router stays a router: this is a four-step protocol
 * (validate the link shape, strip the credential out of the URL, POST it to `/pair`,
 * validate the reply) with its own failure vocabulary, and none of those steps need the
 * shell, a window, or a tRPC context. The messages are user-facing on purpose — a link that
 * is expired reads differently from one that points at nothing.
 */

const pairingResponseSchema = z.object({
  token: z.string().min(1),
  client: z.object({
    id: z.string(),
    label: z.string(),
    createdAt: z.string(),
  }),
})

export async function exchangePairingLink(link: string): Promise<{ url: string; token: string }> {
  let parsed: URL
  try {
    parsed = new URL(link.trim())
  } catch {
    throw new Error('That is not a valid Porcelain connection link')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Connection links must use HTTP or HTTPS')
  }
  if (parsed.username !== '' || parsed.password !== '') {
    throw new Error('Connection links cannot contain URL credentials')
  }
  if (parsed.pathname !== '/pair' || parsed.search !== '') {
    throw new Error('That is not a valid Porcelain connection link')
  }
  const credential = new URLSearchParams(parsed.hash.slice(1)).get('token')
  if (credential === null || credential === '') {
    throw new Error('That connection link has no pairing credential')
  }
  parsed.hash = ''
  parsed.search = ''
  parsed.pathname = ''
  const url = normalizeDaemonUrl(parsed.toString())
  let response: Response
  try {
    response = await fetch(`${url}/pair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...protocolHeaders },
      body: JSON.stringify({ credential }),
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    throw new Error(`Could not reach the daemon in that connection link`)
  }
  if (response.status === 401) {
    throw new Error('That connection link is expired, already used, or revoked')
  }
  if (!response.ok) throw new Error(`Pairing failed with status ${response.status}`)
  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new Error('The daemon returned an invalid pairing response')
  }
  return { url, token: pairingResponseSchema.parse(body).token }
}
