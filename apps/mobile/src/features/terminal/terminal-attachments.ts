import { MAX_PASTE_FILE_BYTES } from '@porcelain/contracts/terminal'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'

import type { NewTerminalComposerAttachment } from './terminal-composer'

export type PickTerminalFilesResult =
  | { result: 'cancelled' }
  | { result: 'too-large'; name: string }
  | { result: 'ok'; attachments: NewTerminalComposerAttachment[] }
  | { result: 'read-failed' }

/**
 * Pick files through the OS document provider, copy them into the app cache, then transfer bytes
 * to the daemon. A provider URI is intentionally never passed through as a terminal path: it is
 * meaningful only on this phone/tablet and may grant temporary provider access.
 */
export async function pickTerminalFiles(): Promise<PickTerminalFilesResult> {
  const picked = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: true,
    type: '*/*',
  })
  if (picked.canceled) return { result: 'cancelled' }

  const attachments: NewTerminalComposerAttachment[] = []
  for (const asset of picked.assets) {
    if (asset.size !== undefined && asset.size !== null && asset.size > MAX_PASTE_FILE_BYTES) {
      return { name: asset.name, result: 'too-large' }
    }
    try {
      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      })
      // Providers may omit size, so repeat the limit after reading before retaining memory.
      if (base64.length > Math.ceil((MAX_PASTE_FILE_BYTES * 4) / 3)) {
        return { name: asset.name, result: 'too-large' }
      }
      attachments.push({
        base64,
        filename: asset.name || 'attachment',
        kind: 'file',
        mime: asset.mimeType || 'application/octet-stream',
      })
    } catch {
      return { result: 'read-failed' }
    }
  }
  return { attachments, result: 'ok' }
}
