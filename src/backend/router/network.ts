import { z } from 'zod'
import { funnelStatus, startFunnel, stopFunnel } from '../net/funnel'
import {
  ifaceListenerPort,
  lanBindError,
  lanNumericUrl,
  lanUrl,
  startLanListener,
  startTailnetListener,
  stopLanListener,
  stopTailnetListener,
  tailnetBindError,
  tailnetUrl,
} from '../net/tailnet-listener'
import { loadConfig, updateConfig } from '../stores/config-store'
import { adminProcedure, t } from '../trpc'

export const networkRouter = t.router({
  // Remote access over Tailscale: the daemon can additionally listen on the
  // detected Tailscale interface (same token, fixed port; see tailnet-listener.ts).
  // `enabled` is the persisted config flag OR the boot env override (`envForced`,
  // PORCELAIN_TAILNET_BIND=1 — a headless daemon enabled by its unit file, so the
  // GUI shows it on but not togglable); `url` is non-null only while the second
  // listener is actually up, and `error` says why nothing bound ('in-use' = the
  // fixed port is squatted) so the UI can distinguish that from "no tailnet here".
  tailnetStatus: adminProcedure.query(
    async (): Promise<{
      enabled: boolean
      url: string | null
      error: 'in-use' | null
      envForced: boolean
      /** Port LAN/tailnet bind (same as PORCELAIN_DAEMON_PORT when set). */
      port: number
    }> => {
      const config = await loadConfig()
      const envForced = process.env.PORCELAIN_TAILNET_BIND === '1'
      return {
        enabled: config.tailnetBind === true || envForced,
        url: tailnetUrl(),
        error: tailnetBindError(),
        envForced,
        port: ifaceListenerPort(),
      }
    },
  ),

  setTailnetBind: adminProcedure.input(z.boolean()).mutation(
    async ({
      input,
    }): Promise<{
      enabled: boolean
      url: string | null
      error: 'in-use' | null
      envForced: boolean
      port: number
    }> => {
      await updateConfig((config) => ({ ...config, tailnetBind: input }))
      // Apply the change live: start the second listener (null url ⇒ no Tailscale
      // interface here) or tear it down. The loopback listener is untouched either way.
      if (input) await startTailnetListener()
      else await stopTailnetListener()
      const envForced = process.env.PORCELAIN_TAILNET_BIND === '1'
      return {
        enabled: input || envForced,
        url: tailnetUrl(),
        error: tailnetBindError(),
        envForced,
        port: ifaceListenerPort(),
      }
    },
  ),

  // Remote access over the home LAN: the daemon can additionally listen on the
  // machine's RFC1918 private addresses (same token, same daemon port; see
  // lan.ts + tailnet-listener.ts). `url` prefers the `<host>.local` Bonjour name;
  // `numericUrl` is the numeric fallback. Both are non-null only while the LAN
  // listener is actually up; `enabled`/`envForced` (PORCELAIN_LAN_BIND=1) and
  // `error` ('in-use' = the port is squatted) mirror tailnetStatus above.
  lanStatus: adminProcedure.query(
    async (): Promise<{
      enabled: boolean
      url: string | null
      numericUrl: string | null
      error: 'in-use' | null
      envForced: boolean
      port: number
    }> => {
      const config = await loadConfig()
      const envForced = process.env.PORCELAIN_LAN_BIND === '1'
      return {
        enabled: config.lanBind === true || envForced,
        url: lanUrl(),
        numericUrl: lanNumericUrl(),
        error: lanBindError(),
        envForced,
        port: ifaceListenerPort(),
      }
    },
  ),

  setLanBind: adminProcedure.input(z.boolean()).mutation(
    async ({
      input,
    }): Promise<{
      enabled: boolean
      url: string | null
      numericUrl: string | null
      error: 'in-use' | null
      envForced: boolean
      port: number
    }> => {
      await updateConfig((config) => ({ ...config, lanBind: input }))
      // Apply the change live: start the LAN listener(s) (null url ⇒ no private
      // interface here) or tear them down. The loopback listener is untouched.
      if (input) await startLanListener()
      else await stopLanListener()
      const envForced = process.env.PORCELAIN_LAN_BIND === '1'
      return {
        enabled: input || envForced,
        url: lanUrl(),
        numericUrl: lanNumericUrl(),
        error: lanBindError(),
        envForced,
        port: ifaceListenerPort(),
      }
    },
  ),

  funnelStatus: adminProcedure.query(async () => ({
    ...(await funnelStatus()),
    envForced: process.env.PORCELAIN_FUNNEL_BIND === '1',
  })),

  setFunnelBind: adminProcedure.input(z.boolean()).mutation(async ({ input }) => {
    const status = input ? await startFunnel() : await stopFunnel()
    await updateConfig((config) => ({ ...config, funnelBind: input }))
    return { ...status, envForced: process.env.PORCELAIN_FUNNEL_BIND === '1' }
  }),
})
