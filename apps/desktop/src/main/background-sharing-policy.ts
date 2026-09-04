export type SharingState = {
  lan: { enabled: boolean }
  tailnet: { enabled: boolean }
  cloudflare: { enabled: boolean; customUrl: string | null }
}

/** A configured remote route means closing the desktop must not take its daemon offline. */
export function hasRemoteSharingRoute(state: SharingState): boolean {
  return (
    state.lan.enabled ||
    state.tailnet.enabled ||
    state.cloudflare.enabled ||
    state.cloudflare.customUrl !== null
  )
}
