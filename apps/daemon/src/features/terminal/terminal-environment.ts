import type { TerminalEnvironmentPort } from './terminal-ports'

const DAEMON_ONLY_ENV = [
  'ELECTRON_RUN_AS_NODE',
  'PORCELAIN_DAEMON_TOKEN',
  'PORCELAIN_ADMIN_TOKEN',
  'PORCELAIN_ADMIN_TOKEN_FILE',
  'PORCELAIN_ACCESS_FILE',
  'PORCELAIN_CLOUDFLARE_BIND',
  'PORCELAIN_CLOUDFLARE_FILE',
  'PORCELAIN_CLOUDFLARE_HOSTNAME',
  'PORCELAIN_CLOUDFLARE_TOKEN',
  'TUNNEL_TOKEN',
  'PORCELAIN_DAEMON_PORT',
  'PORCELAIN_USER_DATA',
  'PORCELAIN_DEV',
  'PORCELAIN_DEV_AUTO_AUTH',
  'PORCELAIN_DEV_CLIENT_TOKEN_FILE',
  'PORCELAIN_DEV_PLAYGROUND',
  'PORCELAIN_ALLOWED_ORIGIN',
  'PORCELAIN_ALLOWED_ORIGINS',
  'PORCELAIN_TAILNET_BIND',
  'PORCELAIN_LAN_BIND',
  'PORCELAIN_E2E',
  'PORCELAIN_SHELL',
  'PORCELAIN_FORCE_LINUX',
  '_VOLTA_TOOL_RECURSION',
] as const

function firstNonBlank(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => value !== undefined && value.trim() !== '')
}

export function createTerminalEnvironment(
  source: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): TerminalEnvironmentPort {
  const environment: Record<string, string> = {}
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined && !DAEMON_ONLY_ENV.includes(key as (typeof DAEMON_ONLY_ENV)[number])) {
      environment[key] = value
    }
  }
  environment.TERM = 'xterm-256color'
  environment.COLORTERM = 'truecolor'

  const shell =
    firstNonBlank(source.PORCELAIN_SHELL, source.SHELL) ??
    (platform === 'win32' ? 'powershell.exe' : '/bin/zsh')
  const shellName = shell.trim().replaceAll('\\', '/').split('/').at(-1)?.toLowerCase()

  return Object.freeze({
    shell,
    args:
      platform === 'win32'
        ? shellName === 'powershell.exe' || shellName === 'pwsh.exe'
          ? Object.freeze(['-NoLogo'])
          : Object.freeze([])
        : Object.freeze(['-l']),
    environment: Object.freeze(environment),
  })
}
