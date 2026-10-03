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
  close(): Promise<void>;
  connectToServer(): RoutedSocket;
  onClose(handler: () => void): void;
  onMessage(handler: (message: string | Buffer) => void): void;
  send(message: string | Buffer): void;
};

type CallHandler = (call: RoutedCall) => Promise<void>;

export type RoutedContext = {
  route(url: string, handler: CallHandler): Promise<unknown>;
  unroute(url: string, handler: CallHandler): Promise<unknown>;
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
  let down = false;
  const deliver = () => {
    holding = false;
    for (const send of notices.splice(0)) send();
  };
  const live = {
    route: () =>
      context.routeWebSocket(/\/api\/live(?:\?|$)/, (socket) => {
        if (down) {
          void socket.close();
          return;
        }
        const server = socket.connectToServer();
        sockets.add(socket);
        socket.onClose(() => sockets.delete(socket));
        server.onClose(() => sockets.delete(socket));
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
    drop: () => {
      down = true;
      for (const socket of sockets) void socket.close();
      sockets.clear();
    },
    restore: () => {
      down = false;
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
    const handler: CallHandler = (call) =>
      matches(call.request())
        ? call.fulfill({ status, body: '' })
        : call.fallback();
    await context.route('**/api/**', handler);
    return () => context.unroute('**/api/**', handler);
  }
  return { live, hold, holdNext, fail };
}
