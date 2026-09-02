const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses')
const path = require('node:path')

/**
 * electron-builder afterPack hook — flips Electron security fuses on the
 * packaged Electron executable before signing. Called by electron-builder BEFORE
 * code signing, so the binary mutation is included in the signature.
 *
 * Conservative, node-pty-safe fuse set:
 *   - RunAsNode OFF          : disables ELECTRON_RUN_AS_NODE
 *   - NodeOptions OFF        : disables ELECTRON_NODE_OPTIONS
 *   - InspectArguments OFF   : disables --inspect / --inspect-brk
 *   - OnlyLoadAppFromAsar ON : blocks loading app JS from outside app.asar;
 *                              does NOT block the unpacked node-pty native addon
 *                              (pty.node + spawn-helper) in app.asar.unpacked.
 *   - CookieEncryption ON    : low-risk, good hygiene.
 *
 * EnableEmbeddedAsarIntegrityValidation is deliberately omitted in this
 * iteration — it requires the asar header hash to be embedded and can interact
 * with asarUnpack. Enable it only after proving the packaged PTY and updater paths.
 *
 * SMOKE TEST REQUIRED after every packaging:
 *   1. Open a terminal tab → a PTY must spawn and run a command (OnlyLoadAppFromAsar
 *      + node-pty unpacked).
 *   2. Launch the app normally → no update-check crash (updater still works).
 *   3. Setting ELECTRON_RUN_AS_NODE=1 must NOT make Porcelain run as Node.
 */
exports.default = async function afterPack(context) {
  const { electronPlatformName, appOutDir } = context
  // Flip fuses on every desktop target — the RunAsNode fuse guards the daemon
  // fork-bomb on every platform, and @electron/fuses is platform-independent.
  if (!['darwin', 'linux', 'win32'].includes(electronPlatformName)) return

  // The fuse target is the packaged Electron executable: `Foo.app` on mac,
  // `foo.exe` on Windows, and the bare `foo` binary on Linux.
  const { productFilename } = context.packager.appInfo
  const app =
    electronPlatformName === 'darwin'
      ? path.join(appOutDir, `${productFilename}.app`)
      : path.join(
          appOutDir,
          `${context.packager.executableName || productFilename}${electronPlatformName === 'win32' ? '.exe' : ''}`,
        )

  await flipFuses(app, {
    version: FuseVersion.V1,
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
    [FuseV1Options.EnableCookieEncryption]: true,
    // EnableEmbeddedAsarIntegrityValidation deliberately omitted — see above.
  })
}
