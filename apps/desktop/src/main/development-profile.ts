/** An explicit profile keeps packaged runtime proof isolated from installed-app state. */
export function isDevelopmentProfile(
  toolkitDevelopment: boolean,
  requested = process.env.PORCELAIN_DEV,
): boolean {
  return toolkitDevelopment || requested === '1'
}
