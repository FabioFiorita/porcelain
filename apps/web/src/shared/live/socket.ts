import {
  issueLiveTicketResponseSchema,
  liveNoticeSchema,
} from '@porcelain/contracts/access';
import { requestJson } from '../api/request';
import { reportUnauthorized } from '../api/unauthorized';
import type { LiveSubscription, LiveUpdatePort } from '@/shared/live/port';

const MAX_RECONNECT_MS = 10_000;

type LiveServer = {
  open: (signal: AbortSignal) => Promise<WebSocket>;
  onUnauthorized: () => void;
};

function createLiveUpdates(server: LiveServer): LiveUpdatePort {
  return {
    connect({ signal, onNotice, onReconnect }) {
      let socket: WebSocket | null = null;
      let subscription: LiveSubscription = {
        type: 'subscribe',
        projects: [],
        worktrees: [],
      };
      let readyCount = 0;
      let retryMs = 500;
      let retry: ReturnType<typeof setTimeout> | undefined;
      const retryLater = () => {
        if (signal.aborted) return;
        retry = setTimeout(() => void open(), retryMs);
        retryMs = Math.min(retryMs * 2, MAX_RECONNECT_MS);
      };
      const listen = (opened: WebSocket) => {
        socket = opened;
        opened.addEventListener('message', (event) => {
          let value: unknown;
          try {
            value = JSON.parse(String(event.data));
          } catch {
            return;
          }
          const parsed = liveNoticeSchema.safeParse(value);
          if (!parsed.success) return;
          if (parsed.data.type === 'ready') {
            if (readyCount > 0) onReconnect();
            readyCount += 1;
            retryMs = 500;
            opened.send(JSON.stringify(subscription));
          }
          onNotice(parsed.data);
        });
        opened.addEventListener('close', (event) => {
          socket = null;
          if (event.code === 4001) {
            server.onUnauthorized();
            return;
          }
          retryLater();
        });
      };
      const open = async () => {
        if (signal.aborted) return;
        let opened: WebSocket;
        try {
          opened = await server.open(signal);
        } catch {
          retryLater();
          return;
        }
        if (signal.aborted) opened.close();
        else listen(opened);
      };
      signal.addEventListener(
        'abort',
        () => {
          if (retry) clearTimeout(retry);
          socket?.close(1000, 'Workspace disconnected');
          socket = null;
        },
        { once: true },
      );
      void open();
      return {
        subscribe(value) {
          subscription = value;
          if (socket?.readyState === WebSocket.OPEN)
            socket.send(JSON.stringify(value));
        },
      };
    },
  };
}

function sameOriginAddress() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${location.host}/api/live`;
}

function remoteAddress(address: string, ticket: string) {
  const origin = new URL(address);
  const protocol = origin.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${origin.host}/api/live?${new URLSearchParams({ ticket })}`;
}

export function sameOriginLiveUpdates(): LiveUpdatePort {
  return createLiveUpdates({
    open: async () => new WebSocket(sameOriginAddress()),
    onUnauthorized: reportUnauthorized,
  });
}

export function remoteLiveUpdates(
  address: string,
  transport: typeof fetch,
): LiveUpdatePort {
  return createLiveUpdates({
    async open(signal) {
      const { ticket } = await requestJson(
        transport,
        '/api/live/tickets',
        issueLiveTicketResponseSchema,
        { method: 'POST', signal },
      );
      return new WebSocket(remoteAddress(address, ticket));
    },
    onUnauthorized: () => undefined,
  });
}
