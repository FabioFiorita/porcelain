export {
  parseCliArguments,
  ServeConfigurationError,
  type ServeSettings,
} from './arguments.ts';
export { runLocalServer } from './launcher.ts';
export { installShutdownSignals } from './signals.ts';
export { reportStatus, statusExitCodes } from './status.ts';

export const serveHelp = `Usage: porcelain <command> [options]

Commands:
  serve                    Serve the built web app and the Porcelain server
  status                   Report whether a server owns the data directory
  pair <name>...           Print a one-time pairing link per device name
  devices                  List pending pairing links and paired devices
  revoke <id>              Revoke a pending link or a paired device
  mcp                      Serve MCP over the local socket, for an agent
  service <action>         Install, inspect, update, or uninstall the user service
  help                     Show this help

Options:
  --lan                    Listen on 0.0.0.0 for LAN access
  --host <host>            Listen host (default: 127.0.0.1)
  --allow-host <host>      Answer to this host name as well (repeatable)
  --address <origin>       Origin a pairing link points at (repeatable)
  --port <port>            Listen port (default: 3000)
  --data-directory <path>  Persistent state directory (default: ~/.porcelain)
  --allow-downgrade        Permit service update to an older invoked CLI version
  -h, --help               Show this help
`;
