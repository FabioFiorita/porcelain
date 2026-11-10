export type DesktopWeb = 'built' | 'development';

export function desktopContentSecurityPolicy(web: DesktopWeb): string {
  const scripts = web === 'development' ? "'self' 'unsafe-inline'" : "'self'";
  return `default-src 'self'; script-src ${scripts}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self' http: https: ws: wss:; frame-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'`;
}
