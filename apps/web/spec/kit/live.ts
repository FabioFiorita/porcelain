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
