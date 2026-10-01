import { desktopAddress, localNavigation } from './navigation.ts';

export function liveAddress(server: string): string {
  const address = new URL('/api/live', server);
  address.protocol = address.protocol === 'https:' ? 'wss:' : 'ws:';
  return address.href;
}

export function liveSocketHeaders<Frame>(
  request: {
    url: string;
    contentsId: number | undefined;
    frame: Frame | null | undefined;
    initiatorOrigin: string | undefined;
    headers: Record<string, string>;
  },
  app: { contentsId: number; mainFrame: Frame; url: string } | undefined,
  server: { address: string; credential: string },
): Record<string, string> | undefined {
  if (
    app === undefined ||
    request.contentsId !== app.contentsId ||
    request.frame !== app.mainFrame ||
    request.initiatorOrigin !== desktopAddress ||
    !localNavigation(app.url, desktopAddress) ||
    request.url !== liveAddress(server.address)
  )
    return undefined;
  return {
    ...request.headers,
    Authorization: `Bearer ${server.credential}`,
    Origin: new URL(server.address).origin,
  };
}
