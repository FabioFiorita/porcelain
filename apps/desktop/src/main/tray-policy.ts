/** macOS uses the Dock and application menu; Porcelain has no useful menu-bar action. */
export function shouldInstallTray(platform: NodeJS.Platform): boolean {
  return platform !== 'darwin'
}
