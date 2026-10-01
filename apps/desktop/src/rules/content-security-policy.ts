export function desktopContentSecurityPolicy(): string {
  return "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' http: https: ws: wss:; frame-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'";
}
