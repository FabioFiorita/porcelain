import { expect, it } from 'vitest';
import { agentMcpCommand, devicePlatformName } from './settings';

it.each([
  ['claude', 'claude mcp add porcelain -- porcelain mcp'],
  ['codex', 'codex mcp add porcelain -- porcelain mcp'],
] as const)('builds the %s MCP command', (agent, expected) => {
  expect(
    agentMcpCommand('claude mcp add porcelain -- porcelain mcp', agent),
  ).toBe(expected);
});

it('keeps the desktop executable, data directory and shell quoting for Codex', () => {
  expect(
    agentMcpCommand(
      "claude mcp add porcelain -- '/Applications/Porcelain Dev' '--porcelain-mcp' '--data-directory' '/tmp/profile/server'",
      'codex',
    ),
  ).toBe(
    "codex mcp add porcelain -- '/Applications/Porcelain Dev' '--porcelain-mcp' '--data-directory' '/tmp/profile/server'",
  );
});

it.each([
  ['', 'Unknown platform'],
  ['iOS 26.1', 'iOS 26.1'],
  ['Android', 'Android'],
  ['Browser', 'Browser'],
  [
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36',
    'Chrome on Linux',
  ],
  [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/26.0 Safari/605.1.15',
    'Safari on macOS',
  ],
  [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0',
    'Edge on Windows',
  ],
  [
    'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0',
    'Firefox on Linux',
  ],
  [
    'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36',
    'Chrome on Android',
  ],
  [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/140.0 Mobile/15E148 Safari/604.1',
    'Chrome on iOS',
  ],
  [
    'Mozilla/5.0 (iPad; CPU OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1',
    'Safari on iPadOS',
  ],
  [
    'Mozilla/5.0 (X11; CrOS x86_64 1) AppleWebKit/537.36 Chrome/140.0 Safari/537.36',
    'Chrome on ChromeOS',
  ],
  ['Mozilla/5.0 (unknown)', 'Browser'],
])('shows a readable platform for %s', (input, expected) => {
  expect(devicePlatformName(input)).toBe(expected);
});
