export type AppPlatform = 'darwin' | 'linux' | 'win32'

// The effective platform. `forceLinux` (PORCELAIN_FORCE_LINUX=1) previews the
// Linux chrome on any OS; otherwise darwin/win32 map through and everything else
// (including freebsd and friends) is treated as Linux. Pure so it's unit-testable.
export function resolvePlatform(platform: NodeJS.Platform, forceLinux: boolean): AppPlatform {
  if (forceLinux) return 'linux'
  if (platform === 'darwin') return 'darwin'
  if (platform === 'win32') return 'win32'
  return 'linux'
}

export const appPlatform: AppPlatform = resolvePlatform(
  process.platform,
  process.env.PORCELAIN_FORCE_LINUX === '1',
)

export const isMac = appPlatform === 'darwin'
export const isLinux = appPlatform === 'linux'
export const isWindows = appPlatform === 'win32'
