import { appDocument, desktopAddress } from './navigation.ts';

export function liveAddress(server: string, path: string): string {
  const address = new URL(path, server);
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
  server: { address: string; credential: string; livePath: string },
): Record<string, string> | undefined {
  if (
    app === undefined ||
    request.contentsId !== app.contentsId ||
    request.frame !== app.mainFrame ||
    request.initiatorOrigin !== desktopAddress ||
    !appDocument(app.url) ||
    request.url !== liveAddress(server.address, server.livePath)
  )
    return undefined;
  return {
    ...request.headers,
    Authorization: `Bearer ${server.credential}`,
    Origin: new URL(server.address).origin,
  };
}
