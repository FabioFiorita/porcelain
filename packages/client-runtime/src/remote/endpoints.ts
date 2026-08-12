import { orderedEndpointUrls } from '@porcelain/contracts'

export type RemoteEndpointGroup = {
  readonly url: string
  readonly endpoints?: readonly string[]
  readonly preferredEndpoint?: string
}

export function orderRemoteEndpoints(group: RemoteEndpointGroup): string[] {
  return orderedEndpointUrls(group)
}
