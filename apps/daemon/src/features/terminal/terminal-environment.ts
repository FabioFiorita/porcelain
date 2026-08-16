import type { TerminalEnvironmentPort } from './terminal-ports'

const DAEMON_ONLY_ENV = [
  'ELECTRON_RUN_AS_NODE',
  'PORCELAIN_DAEMON_TOKEN',
  'PORCELAIN_ADMIN_TOKEN',
  'PORCELAIN_ADMIN_TOKEN_FILE',
  'PORCELAIN_ACCESS_FILE',
  'PORCELAIN_FUNNEL_BIND',
  'PORCELAIN_FUNNEL_FILE',
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
): TerminalEnvironmentPort {
  const environment: Record<string, string> = {}
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined && !DAEMON_ONLY_ENV.includes(key as (typeof DAEMON_ONLY_ENV)[number])) {
      environment[key] = value
    }
  }
  environment.TERM = 'xterm-256color'
  environment.COLORTERM = 'truecolor'

  return Object.freeze({
    shell: firstNonBlank(source.PORCELAIN_SHELL, source.SHELL) ?? '/bin/zsh',
    environment: Object.freeze(environment),
  })
}
