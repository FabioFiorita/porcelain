import type {
  DesktopAction,
  DesktopAppearance,
  DesktopBridge,
} from '@porcelain/contracts/desktop';
import { desktopShell } from '@/shared/shell';

declare global {
  interface Window {
    porcelainDesktop?: DesktopBridge;
  }
}

export function desktopLiveAddress(): string | undefined {
  return desktopShell ? window.porcelainDesktop?.liveAddress() : undefined;
}

export function onDesktopAction(
  receive: (action: DesktopAction) => void,
): () => void {
  return desktopShell
    ? (window.porcelainDesktop?.onAction(receive) ?? (() => undefined))
    : () => undefined;
}

export function setDesktopAppearance(appearance: DesktopAppearance): void {
  if (desktopShell) window.porcelainDesktop?.setAppearance(appearance);
}

export function connectDesktopChrome(): () => void {
  if (!desktopShell) return () => undefined;
  document.documentElement.classList.add('desktop-shell');
  const fullscreen = (value: boolean) =>
    document.documentElement.classList.toggle('desktop-fullscreen', value);
  fullscreen(window.porcelainDesktop?.isFullscreen() ?? false);
  const unsubscribe = window.porcelainDesktop?.onFullscreen(fullscreen);
  return () => {
    unsubscribe?.();
    document.documentElement.classList.remove(
      'desktop-shell',
      'desktop-fullscreen',
    );
  };
}

export function desktopAppUpdate() {
  return desktopShell ? window.porcelainDesktop?.appUpdate : undefined;
}

export function desktopCredentialStorage<S>(read: (saved: unknown) => S) {
  const credentials = desktopShell
    ? window.porcelainDesktop?.credentials
    : undefined;
  if (!credentials) return undefined;
  return {
    async getItem() {
      const stored = await credentials.read();
      if (stored == null) return null;
      try {
        return { state: read(JSON.parse(stored)) };
      } catch {
        return { state: read(null) };
      }
    },
    async setItem(_name: string, value: { state: S }) {
      await credentials.write(JSON.stringify(value.state));
    },
    async removeItem() {
      await credentials.clear();
    },
  };
}
