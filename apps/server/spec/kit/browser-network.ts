export type RoutedRequest = {
  method(): string;
  url(): string;
  postData(): string | null;
};

export type RoutedCall = {
  request(): RoutedRequest;
  fallback(): Promise<void>;
  fulfill(response: { status: number; body: string }): Promise<void>;
};

type RoutedSocket = {
  url(): string;
  close(options?: {
    code?: number | undefined;
    reason?: string | undefined;
  }): Promise<void>;
  connectToServer(): RoutedSocket;
  onClose(handler: (code?: number, reason?: string) => Promise<void>): void;
  onMessage(handler: (message: string | Buffer) => void): void;
  send(message: string | Buffer): void;
};

type CallHandler = (call: RoutedCall) => Promise<void>;

export type RoutedContext = {
  route(url: string, handler: CallHandler): Promise<unknown>;
  routeWebSocket(
    url: RegExp,
    handler: (socket: RoutedSocket) => void,
  ): Promise<unknown>;
};

export type RequestMatch = (request: RoutedRequest) => boolean;

type HoldOptions = { once?: boolean; onHold?: () => void };

export type HeldRequest = {
  requested: Promise<void>;
  arm(): void;
  release(): void;
};

export function browserNetwork(context: RoutedContext) {
  const sockets = new Set<RoutedSocket>();
  const notices: Array<() => void> = [];
  let holding = false;
  const unavailable = new Set<string | undefined>();
  const atHost = (socket: RoutedSocket, host?: string) =>
    host === undefined || new URL(socket.url()).host === host;
  const deliver = () => {
    holding = false;
    for (const send of notices.splice(0)) send();
  };
  const live = {
    route: () =>
      context.routeWebSocket(/\/api\/live(?:\?|$)/, (socket) => {
        if ([...unavailable].some((host) => atHost(socket, host))) {
          void socket.close();
          return;
        }
        const server = socket.connectToServer();
        sockets.add(socket);
        socket.onClose((code, reason) => {
          sockets.delete(socket);
          return server.close({ code, reason });
        });
        server.onClose((code, reason) => {
          sockets.delete(socket);
          return socket.close({ code, reason });
        });
        server.onMessage((message) => {
          if (holding) notices.push(() => socket.send(message));
          else socket.send(message);
        });
      }),
    hold: () => {
      holding = true;
      return { release: deliver };
    },
    release: deliver,
    drop: (host?: string) => {
      unavailable.add(host);
      for (const socket of sockets) {
        if (!atHost(socket, host)) continue;
        sockets.delete(socket);
        void socket.close();
      }
    },
    restore: (host?: string) => {
      unavailable.delete(host);
    },
    connected: () => sockets.size > 0,
  };
  async function hold(
    matches: RequestMatch,
    { once = false, onHold = () => {} }: HoldOptions = {},
  ): Promise<HeldRequest> {
    let armed = false;
    let held = false;
    let open = false;
    const requested = Promise.withResolvers<void>();
    const released = Promise.withResolvers<void>();
    await context.route('**/api/**', async (call) => {
      if (armed && !open && !(once && held) && matches(call.request())) {
        held = true;
        onHold();
        requested.resolve();
        await released.promise;
      }
      await call.fallback();
    });
    return {
      requested: requested.promise,
      arm() {
        armed = true;
      },
      release: () => {
        open = true;
        released.resolve();
      },
    };
  }
  const holdNext = (matches: RequestMatch, onHold?: () => void) =>
    hold(
      matches,
      onHold === undefined ? { once: true } : { once: true, onHold },
    );
  async function fail(matches: RequestMatch, status: number) {
    let failing = true;
    const handler: CallHandler = (call) =>
      failing && matches(call.request())
        ? call.fulfill({ status, body: '' })
        : call.fallback();
    await context.route('**/api/**', handler);
    return async () => {
      failing = false;
    };
  }
  return { live, hold, holdNext, fail };
}
