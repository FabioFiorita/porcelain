import {
  cloudflareStatusOutputSchema,
  lanStatusOutputSchema,
  tailnetStatusOutputSchema,
} from '@porcelain/contracts/remote'
import { createTRPCUntypedClient, httpLink } from '@trpc/client'
import { hasRemoteSharingRoute } from './background-sharing-policy'
import { localDaemonPair } from './daemon'
import { daemonHeaders } from './daemon-headers'

/**
 * Ask the authoritative local daemon whether this machine is being shared.
 * If the status check itself fails, keep the process alive: a transient local-daemon restart
 * must not turn a window close into an accidental remote outage.
 */
export async function localSharingKeepsAppRunning(): Promise<boolean> {
  const daemon = localDaemonPair()
  if (daemon.url === '') return false

  try {
    const client = createTRPCUntypedClient({
      links: [httpLink({ url: `${daemon.url}/trpc`, headers: daemonHeaders(daemon.token) })],
    })
    const [lan, tailnet, cloudflare] = await Promise.all([
      client.query('lanStatus'),
      client.query('tailnetStatus'),
      client.query('cloudflareStatus'),
    ])
    return hasRemoteSharingRoute({
      lan: lanStatusOutputSchema.parse(lan),
      tailnet: tailnetStatusOutputSchema.parse(tailnet),
      cloudflare: cloudflareStatusOutputSchema.parse(cloudflare),
    })
  } catch (error) {
    console.error('[desktop] could not read sharing status; keeping daemon alive:', error)
    return true
  }
}
