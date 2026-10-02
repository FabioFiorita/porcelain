import type { BrowserContext, Route, WebSocketRoute } from '@playwright/test';

type Held = { requested: Promise<void>; arm(): void; release(): void };

function holdOnce(
  matches: (route: Route) => boolean,
  onHold: () => void = () => {},
) {
  let armed = false;
  let held = false;
  let markRequested = () => {};
  let releaseRequest = () => {};
  const requested = new Promise<void>((resolve) => {
    markRequested = resolve;
  });
  const released = new Promise<void>((resolve) => {
    releaseRequest = resolve;
  });
  const handler = async (route: Route) => {
    if (armed && !held && matches(route)) {
      held = true;
      onHold();
      markRequested();
      await released;
    }
    await route.fallback();
  };
  return {
    handler,
    gate: {
      requested,
      arm() {
        armed = true;
      },
      release: releaseRequest,
    } satisfies Held,
  };
}

export async function liveRouter(context: BrowserContext) {
  const sockets = new Set<WebSocketRoute>();
  const held: Array<() => void> = [];
  let holding = false;
  let down = false;
  await context.routeWebSocket(/\/api\/live(?:\?|$)/, (socket) => {
    if (down) {
      void socket.close();
      return;
    }
    const server = socket.connectToServer();
    sockets.add(socket);
    socket.onClose(() => sockets.delete(socket));
    server.onClose(() => sockets.delete(socket));
    server.onMessage((message) => {
      if (holding) held.push(() => socket.send(message));
      else socket.send(message);
    });
  });
  const deliver = () => {
    holding = false;
    for (const send of held.splice(0)) send();
  };
  return {
    hold() {
      holding = true;
      return { release: deliver };
    },
    drop() {
      down = true;
      for (const socket of sockets) void socket.close();
      sockets.clear();
    },
    restore() {
      down = false;
    },
    connected: () => sockets.size > 0,
    async holdNextChangeDiff(filePath: string) {
      const { handler, gate } = holdOnce(
        (route) => {
          const request = route.request();
          return (
            request.method() === 'POST' &&
            new URL(request.url()).pathname.endsWith('/changes/diffs') &&
            (request.postData() ?? '').includes(filePath)
          );
        },
        () => {
          holding = true;
        },
      );
      await context.route('**/api/**', handler);
      return gate;
    },
    releaseHeld: deliver,
  };
}

export type LiveRouter = Awaited<ReturnType<typeof liveRouter>>;

export async function holdNextReviewRead(context: BrowserContext) {
  const { handler, gate } = holdOnce((route) => {
    const request = route.request();
    return (
      request.method() === 'GET' &&
      new URL(request.url()).pathname.endsWith('/review')
    );
  });
  await context.route('**/api/**', handler);
  return gate;
}

export async function holdNextPost(context: BrowserContext, ending: string) {
  const { handler, gate } = holdOnce((route) => {
    const request = route.request();
    return (
      request.method() === 'POST' &&
      new URL(request.url()).pathname.endsWith(ending)
    );
  });
  await context.route('**/api/**', handler);
  return gate;
}

export async function failInventory(context: BrowserContext) {
  const handler = (route: Route) => route.fulfill({ status: 503, body: '' });
  await context.route('**/api/inventory', handler);
  return () => context.unroute('**/api/inventory', handler);
}
