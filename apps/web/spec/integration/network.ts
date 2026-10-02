export function createFetchGate(filePath: string) {
  let restore = () => {};
  return {
    holdNextChangeDiff() {
      const original = window.fetch;
      const OriginalSocket = window.WebSocket;
      let releaseRequest = () => {};
      let markRequested = () => {};
      let held = false;
      let armed = false;
      let liveHeld = true;
      const notices: Array<() => void> = [];
      const requested = new Promise<void>((resolve) => {
        markRequested = resolve;
      });
      const released = new Promise<void>((resolve) => {
        releaseRequest = resolve;
      });
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
              if (held && liveHeld) notices.push(deliver);
              else deliver();
            },
            options,
          );
        }
      }
      window.WebSocket = GatedSocket;
      window.fetch = async (input, init) => {
        const path =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        if (
          armed &&
          !held &&
          init?.method === 'POST' &&
          typeof init.body === 'string' &&
          init.body.includes(filePath) &&
          path.endsWith('/changes/diffs')
        ) {
          held = true;
          markRequested();
          await released;
        }
        return original(input, init);
      };
      restore = () => {
        releaseRequest();
        liveHeld = false;
        for (const notice of notices) notice();
        notices.length = 0;
        window.fetch = original;
        window.WebSocket = OriginalSocket;
      };
      return {
        requested,
        arm() {
          armed = true;
        },
        release: releaseRequest,
      };
    },
    holdNextReviewRead() {
      const original = window.fetch;
      let releaseRequest = () => {};
      let markRequested = () => {};
      let armed = false;
      let open = false;
      const requested = new Promise<void>((resolve) => {
        markRequested = resolve;
      });
      const released = new Promise<void>((resolve) => {
        releaseRequest = resolve;
      });
      window.fetch = async (input, init) => {
        const path =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        if (
          armed &&
          !open &&
          (init?.method ?? 'GET') === 'GET' &&
          new URL(path, location.href).pathname.endsWith('/review')
        ) {
          markRequested();
          await released;
        }
        return original(input, init);
      };
      const release = () => {
        open = true;
        releaseRequest();
      };
      restore = () => {
        release();
        window.fetch = original;
      };
      return {
        requested,
        arm() {
          armed = true;
        },
        release,
      };
    },
    holdNextPost(pathEnding: string) {
      const original = window.fetch;
      let releaseRequest = () => {};
      let markRequested = () => {};
      let armed = false;
      let held = false;
      const requested = new Promise<void>((resolve) => {
        markRequested = resolve;
      });
      const released = new Promise<void>((resolve) => {
        releaseRequest = resolve;
      });
      window.fetch = async (input, init) => {
        const path =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        if (
          armed &&
          !held &&
          init?.method === 'POST' &&
          new URL(path, location.href).pathname.endsWith(pathEnding)
        ) {
          held = true;
          markRequested();
          await released;
        }
        return original(input, init);
      };
      restore = () => {
        releaseRequest();
        window.fetch = original;
      };
      return {
        requested,
        arm() {
          armed = true;
        },
        release: releaseRequest,
      };
    },
    restore() {
      restore();
    },
  };
}
const livePath = '/api/live';
const opened = new Set<WebSocket>();
let down = false;

class FollowedSocket extends WebSocket {
  constructor(url: string | URL, protocols?: string | string[]) {
    super(url, protocols);
    if (new URL(url, location.href).pathname !== livePath) return;
    if (down) {
      this.close();
      return;
    }
    opened.add(this);
    this.addEventListener('close', () => opened.delete(this));
  }
}

window.WebSocket = FollowedSocket;

export const live = {
  drop: () => {
    down = true;
    for (const socket of opened) socket.close();
    opened.clear();
  },
  restore: () => {
    down = false;
  },
  connected: () =>
    [...opened].some((socket) => socket.readyState === WebSocket.OPEN),
};
