import {
  remoteRouteNames,
  remoteRouteTitles,
  type RemoteAccess,
} from '@porcelain/client/access/rules';
import { counted } from '@porcelain/client/changes/rules';

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

export function computerReach(remote: RemoteAccess, devices: number) {
  const titles = (kind: 'on' | 'starting') =>
    remoteRouteNames
      .filter((name) => remote.routes[name].status.kind === kind)
      .map((name) => remoteRouteTitles[name]);
  const on = titles('on');
  const starting = titles('starting');
  let reach = 'Other devices cannot reach it yet.';
  if (on.length > 0)
    reach = `Other devices reach it over ${waysInList.format(on)}.`;
  else if (starting.length > 0)
    reach = `${waysInList.format(starting)} ${starting.length === 1 ? 'is' : 'are'} starting.`;
  return {
    devices: counted(devices, 'paired device'),
    reach,
    unreachable: on.length === 0 && starting.length === 0,
  };
}
