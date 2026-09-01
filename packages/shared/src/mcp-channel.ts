import { createHash } from 'node:crypto'
import { join, resolve } from 'node:path'
import { porcelainHome } from './porcelain-home'

/** Host-local rendezvous for the bundled agent connector, scoped by `PORCELAIN_HOME`. */
export function porcelainMcpChannel(
  home = porcelainHome(),
  platform: NodeJS.Platform = process.platform,
): string {
  const override = process.env.PORCELAIN_MCP_SOCKET
  if (override !== undefined && override !== '') return override

  if (platform === 'win32') {
    const profile = createHash('sha256').update(resolve(home)).digest('hex').slice(0, 20)
    return `\\\\.\\pipe\\porcelain-mcp-${profile}`
  }
  return join(home, 'mcp.sock')
}
