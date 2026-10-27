import {
  remoteRouteNames,
  remoteRouteTitles,
  type RemoteAccess,
} from '@porcelain/client/access/rules';

export function agentMcpCommand(command: string, agent: 'claude' | 'codex') {
  return command.replace(/^claude mcp add /, `${agent} mcp add `);
}

export function devicePlatformName(platform: string) {
  if (!platform.startsWith('Mozilla/')) return platform || 'Unknown platform';
  const browser = /Edg(?:e|A|iOS)?\//.test(platform)
    ? 'Edge'
    : /(?:Firefox|FxiOS)\//.test(platform)
      ? 'Firefox'
      : /(?:Chrome|CriOS)\//.test(platform)
        ? 'Chrome'
        : /Safari\//.test(platform)
          ? 'Safari'
          : 'Browser';
  const system = /iPad/.test(platform)
    ? 'iPadOS'
    : /iPhone|iPod/.test(platform)
      ? 'iOS'
      : /Android/.test(platform)
        ? 'Android'
        : /Windows/.test(platform)
          ? 'Windows'
          : /Macintosh|Mac OS X/.test(platform)
            ? 'macOS'
            : /CrOS/.test(platform)
              ? 'ChromeOS'
              : /Linux/.test(platform)
                ? 'Linux'
                : undefined;
  return system ? `${browser} on ${system}` : browser;
}

export type DeviceKind = 'phone' | 'tablet' | 'browser';

export function deviceKind(platform: string): DeviceKind {
  const name = devicePlatformName(platform);
  if (name.startsWith('iPadOS')) return 'tablet';
  if (/^(?:iOS|Android|Mobile)\b/.test(name)) return 'phone';
  return 'browser';
}

const waysInList = new Intl.ListFormat('en-GB', { type: 'conjunction' });

export function computerSummary(remote: RemoteAccess, devices: number) {
  const ways = remoteRouteNames
    .filter((name) => remote.routes[name].status.kind === 'on')
    .map((name) => remoteRouteTitles[name]);
  return [
    ways.length === 0 ? 'No way in on' : waysInList.format(ways),
    devices === 1 ? '1 device' : `${devices} devices`,
  ].join(' · ');
}

export type CommandPart = {
  text: string;
  kind: 'program' | 'quoted' | 'plain';
};

export function commandParts(command: string): CommandPart[] {
  const [program = '', ...rest] = command.split(/(?<=^\S+)(?=\s)/);
  const parts: CommandPart[] = [{ text: program, kind: 'program' }];
  for (const piece of rest.join('').split(/('[^']*')/))
    if (piece !== '')
      parts.push({
        text: piece,
        kind: piece.startsWith("'") ? 'quoted' : 'plain',
      });
  return parts;
}
