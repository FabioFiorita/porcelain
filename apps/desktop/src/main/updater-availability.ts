/** Why this shell cannot use electron-updater, or null when it can. */
export function updaterUnavailableReason(
  isPackaged: boolean,
  platform: NodeJS.Platform,
  appImage: string | undefined,
): string | null {
  if (!isPackaged) return 'Automatic updates are available in the installed Porcelain app.'
  if (platform === 'linux' && appImage === undefined) {
    return 'Automatic updates are unavailable for this Linux package. Update it with the package manager used to install Porcelain.'
  }
  return null
}
