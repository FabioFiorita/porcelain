import type {
  DesktopAppUpdateCheck,
  DesktopAppUpdateState,
} from '@porcelain/contracts/desktop';

export class LocalAppUpdate {
  private readonly receive: (state: DesktopAppUpdateState) => void;
  private state: DesktopAppUpdateState = { status: 'unavailable' };

  constructor(receive: (state: DesktopAppUpdateState) => void) {
    this.receive = receive;
  }

  read(): DesktopAppUpdateState {
    return this.state;
  }

  check(): Promise<DesktopAppUpdateCheck> {
    this.publish({ status: 'checking' });
    this.publish({ status: 'unavailable' });
    return Promise.resolve({ available: null });
  }

  install(): Promise<void> {
    const message = 'App updates are unavailable for this local build';
    this.publish({ status: 'error', message });
    return Promise.reject(new Error(message));
  }

  private publish(state: DesktopAppUpdateState): void {
    this.state = state;
    this.receive(state);
  }
}
