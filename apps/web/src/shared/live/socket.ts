import {
  issueLiveTicketResponseSchema,
  liveNoticeSchema,
} from '@porcelain/contracts/access';
import { RequestError, requestJson } from '../api/request';
import type { Transport } from '../api/transport';
import { desktopLiveAddress } from '../adapters/desktop';
import type { LiveSubscription, LiveUpdatePort } from '@/shared/live/port';

const MAX_RECONNECT_MS = 10_000;

function createLiveUpdates(
  open: (signal: AbortSignal) => Promise<WebSocket>,
): LiveUpdatePort {
  return {
    connect({ signal, onNotice, onReconnect, onUnauthorized }) {
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
        retry = setTimeout(() => void reopen(), retryMs);
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
            onUnauthorized();
            return;
          }
          retryLater();
        });
      };
      const reopen = async () => {
        if (signal.aborted) return;
        let opened: WebSocket;
        try {
          opened = await open(signal);
        } catch (error) {
          if (signal.aborted) return;
          if (error instanceof RequestError && error.status === 401)
            onUnauthorized();
          else retryLater();
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
      void reopen();
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
  return desktopLiveAddress() ?? `${protocol}//${location.host}/api/live`;
}

function remoteAddress(address: string, ticket: string) {
  const origin = new URL(address);
  const protocol = origin.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${origin.host}/api/live?${new URLSearchParams({ ticket })}`;
}

export function sameOriginLiveUpdates(): LiveUpdatePort {
  return createLiveUpdates(async () => new WebSocket(sameOriginAddress()));
}

export function remoteLiveUpdates(
  address: string,
  transport: Transport,
): LiveUpdatePort {
  return createLiveUpdates(async (signal) => {
    const { ticket } = await requestJson(
      transport,
      '/api/live/tickets',
      issueLiveTicketResponseSchema,
      { method: 'POST', signal },
    );
    return new WebSocket(remoteAddress(address, ticket));
  });
}
