type FetchMatch = (url: URL, init: RequestInit | undefined) => boolean;

function requestUrl(input: RequestInfo | URL): URL {
  const address =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  return new URL(address, location.href);
}

function holdLiveNotices(holding: () => boolean) {
  const OriginalSocket = window.WebSocket;
  const notices: Array<() => void> = [];
  let delivering = false;
  class GatedSocket extends OriginalSocket {
    override addEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) {
      if (type !== 'message') {
        super.addEventListener(type, listener, options);
        return;
      }
      super.addEventListener(
        type,
        (event) => {
          const deliver = () => {
            if (typeof listener === 'function') listener.call(this, event);
            else listener.handleEvent(event);
          };
          if (holding() && !delivering) notices.push(deliver);
          else deliver();
        },
        options,
      );
    }
  }
  window.WebSocket = GatedSocket;
  return () => {
    delivering = true;
    for (const notice of notices.splice(0)) notice();
    window.WebSocket = OriginalSocket;
  };
}

export function createFetchGate(filePath: string) {
  const restores: Array<() => void> = [];
  function holdNextFetch(matches: FetchMatch) {
    const original = window.fetch;
    const requested = Promise.withResolvers<void>();
    const released = Promise.withResolvers<void>();
    let armed = false;
    let held = false;
    let open = false;
    window.fetch = async (input, init) => {
      const url = requestUrl(input);
      if (armed && !open && matches(url, init)) {
        held = true;
        requested.resolve();
        await released.promise;
      }
      return original(input, init);
    };
    const release = () => {
      open = true;
      released.resolve();
    };
    restores.push(() => {
      release();
      window.fetch = original;
    });
    return {
      requested: requested.promise,
      arm() {
        armed = true;
      },
      release,
      held: () => held,
    };
  }
  return {
    recordDirectoryReads() {
      const original = window.fetch;
      const paths: string[] = [];
      window.fetch = (input, init) => {
        if (
          requestUrl(input).pathname.endsWith('/directory') &&
          (init?.method ?? 'GET') === 'GET'
        ) {
          paths.push(requestUrl(input).searchParams.get('path') ?? '');
        }
        return original(input, init);
      };
      restores.push(() => {
        window.fetch = original;
      });
      return paths;
    },
    holdNextChangeDiff() {
      const gate = holdNextFetch(
        (url, init) =>
          init?.method === 'POST' &&
          (typeof init.body === 'string'
            ? init.body
            : init.body instanceof Uint8Array
              ? new TextDecoder().decode(init.body)
              : ''
          ).includes(filePath) &&
          url.pathname.endsWith('/changes/diffs'),
      );
      restores.push(holdLiveNotices(gate.held));
      return gate;
    },
    holdNextReviewRead: () =>
      holdNextFetch(
        (url, init) =>
          (init?.method ?? 'GET') === 'GET' && url.pathname.endsWith('/review'),
      ),
    holdNextDirectoryRead: (directory?: string) =>
      holdNextFetch(
        (url, init) =>
          (init?.method ?? 'GET') === 'GET' &&
          url.pathname.endsWith('/directory') &&
          (directory === undefined ||
            url.searchParams.get('path') === directory),
      ),
    holdNextPost: (pathEnding: string) =>
      holdNextFetch(
        (url, init) =>
          init?.method === 'POST' && url.pathname.endsWith(pathEnding),
      ),
    restore() {
      for (const restore of restores.splice(0).reverse()) restore();
    },
  };
}

const livePath = '/api/live';
const opened = new Set<WebSocket>();
let down = false;
let reconnecting = Promise.withResolvers<void>();

class FollowedSocket extends WebSocket {
  constructor(url: string | URL, protocols?: string | string[]) {
    super(url, protocols);
    if (new URL(url, location.href).pathname !== livePath) return;
    if (down) {
      this.close();
      reconnecting.resolve();
      return;
    }
    opened.add(this);
    this.addEventListener('close', () => opened.delete(this));
  }
}

window.WebSocket = FollowedSocket;

export const live = {
  drop: () => {
    reconnecting = Promise.withResolvers<void>();
    down = true;
    for (const socket of opened) socket.close();
    opened.clear();
  },
  restore: () => {
    down = false;
  },
  reconnecting: () => reconnecting.promise,
  connected: () =>
    [...opened].some((socket) => socket.readyState === WebSocket.OPEN),
};
