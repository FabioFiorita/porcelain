import { liveNoticeSchema } from '@porcelain/contracts/live-updates';
import { reportUnauthorized } from '../unauthorized';
import type { LiveUpdatePort } from './port';

const MAX_RECONNECT_MS = 10_000;

export function createLiveUpdatesLive(): LiveUpdatePort {
  return {
    connect({ signal, onNotice, onReconnect }) {
      let socket: WebSocket | null = null;
      let subscription: Parameters<
        ReturnType<LiveUpdatePort['connect']>['subscribe']
      >[0] = {
        type: 'subscribe',
        projects: [],
        worktrees: [],
      };
      let readyCount = 0;
      let retryMs = 500;
      let retry: ReturnType<typeof setTimeout> | undefined;
      const open = () => {
        if (signal.aborted) return;
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        socket = new WebSocket(`${protocol}//${location.host}/api/live`);
        socket.addEventListener('message', (event) => {
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
            socket?.send(JSON.stringify(subscription));
          }
          onNotice(parsed.data);
        });
        socket.addEventListener('close', (event) => {
          socket = null;
          if (event.code === 4001) {
            reportUnauthorized();
            return;
          }
          if (signal.aborted) return;
          retry = setTimeout(open, retryMs);
          retryMs = Math.min(retryMs * 2, MAX_RECONNECT_MS);
        });
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
      open();
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
