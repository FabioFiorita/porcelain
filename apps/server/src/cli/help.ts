import {
  defaultDataDirectoryName,
  defaultListenHost,
  defaultListenPort,
} from '../config/startup-settings.ts';

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
  --host <host>            Listen host (default: ${defaultListenHost})
  --allow-host <host>      Answer to this host name as well (repeatable)
  --address <origin>       Origin a pairing link points at (repeatable)
  --port <port>            Listen port (default: ${defaultListenPort})
  --data-directory <path>  Persistent state directory (default: ~/${defaultDataDirectoryName})
  --allow-downgrade        Permit service update to an older invoked CLI version
  -h, --help               Show this help
`;
