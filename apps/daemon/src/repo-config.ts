import { z } from 'zod'

export const appConfigSchema = z
  .object({
    // Global (not per-repo): when true the daemon additionally listens on the
    // detected Tailscale interface (see backend/tailnet.ts + server.ts), gated on
    // the same authentication gate. Absent/false ⇒ loopback only. Toggled from Settings.
    tailnetBind: z.boolean().optional(),
    // Global (not per-repo): when true the daemon additionally listens on the
    // machine's RFC1918 private addresses (see backend/lan.ts + server.ts) so
    // devices on the home LAN can reach it, gated on the same authentication. Cleartext on
    // the LAN — opt-in, default off (see the audit skill). Toggled from Settings.
    lanBind: z.boolean().optional(),
    // Public HTTPS reverse proxy managed through `tailscale funnel`.
    funnelBind: z.boolean().optional(),
  })
  .strict()

export type AppConfig = z.infer<typeof appConfigSchema>

export const emptyConfig: AppConfig = {}
