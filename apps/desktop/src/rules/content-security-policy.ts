import { createHash } from 'node:crypto';
import { PREVIEW_BRIDGE_SCRIPT } from '@porcelain/client/files/rules';

export type DesktopWeb = 'built' | 'development';

const previewBridge = `'sha256-${createHash('sha256').update(PREVIEW_BRIDGE_SCRIPT).digest('base64')}'`;

export function desktopContentSecurityPolicy(web: DesktopWeb): string {
  const scripts =
    web === 'development'
      ? "'self' 'unsafe-inline'"
      : `'self' ${previewBridge}`;
  return `default-src 'self'; script-src ${scripts}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' http: https: ws: wss:; frame-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'`;
}
