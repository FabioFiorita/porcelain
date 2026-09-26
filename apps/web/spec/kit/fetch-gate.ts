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
    restore() {
      restore();
    },
  };
}
