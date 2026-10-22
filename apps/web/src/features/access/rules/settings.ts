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
