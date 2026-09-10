import { FileInspectionError } from '../errors/file-inspection-error.ts';

export function decodeText(bytes: Buffer) {
  if (bytes.includes(0)) throw new FileInspectionError('UNSUPPORTED_TEXT');
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
      bytes,
    );
  } catch (error) {
    throw new FileInspectionError('UNSUPPORTED_TEXT', { cause: error });
  }
}
