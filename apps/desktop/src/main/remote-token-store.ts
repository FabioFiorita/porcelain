import { safeStorage } from 'electron'

/**
 * The encrypted bytes still live in Electron's userData directory, but their key lives in the
 * OS credential store (DPAPI on Windows, Keychain on macOS, and the configured secret service on
 * Linux). Keep this boundary tiny: remote-daemon owns document migration, this module only knows
 * how to protect one paired client credential.
 */
export type RemoteTokenProtector = Readonly<{
  available: () => boolean
  encrypt: (token: string) => string
  decrypt: (ciphertext: string) => string
}>

/** A valid environment document could not be read or written through the OS credential store. */
export class RemoteCredentialStoreError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RemoteCredentialStoreError'
  }
}

type SafeStorageBackend = ReturnType<typeof safeStorage.getSelectedStorageBackend>

/** Linux's `basic_text` fallback is reversible with a public, fixed password. Fail closed there. */
export function isSecureStorageBackend(
  platform: NodeJS.Platform,
  backend: SafeStorageBackend,
): boolean {
  if (platform !== 'linux') return true
  return backend !== 'basic_text' && backend !== 'unknown'
}

export const electronRemoteTokenProtector: RemoteTokenProtector = Object.freeze({
  available: () =>
    safeStorage.isEncryptionAvailable() &&
    (process.platform !== 'linux' ||
      isSecureStorageBackend(process.platform, safeStorage.getSelectedStorageBackend())),
  encrypt: (token) => safeStorage.encryptString(token).toString('base64'),
  decrypt: (ciphertext) => safeStorage.decryptString(Buffer.from(ciphertext, 'base64')),
})

export function protectRemoteToken(
  token: string,
  protector: RemoteTokenProtector = electronRemoteTokenProtector,
): string {
  if (!protector.available()) {
    throw new RemoteCredentialStoreError(
      'Porcelain could not access this OS account’s secure credential store, so paired Environment tokens cannot be saved.',
    )
  }
  return protector.encrypt(token)
}

export function revealRemoteToken(
  ciphertext: string,
  protector: RemoteTokenProtector = electronRemoteTokenProtector,
): string {
  if (!protector.available()) {
    throw new RemoteCredentialStoreError(
      'Porcelain could not access this OS account’s secure credential store to read paired Environment tokens.',
    )
  }
  try {
    const token = protector.decrypt(ciphertext)
    if (token.length === 0) throw new Error('empty paired token')
    return token
  } catch {
    throw new RemoteCredentialStoreError(
      'Saved Environment credentials could not be decrypted. Re-pair that Environment.',
    )
  }
}
