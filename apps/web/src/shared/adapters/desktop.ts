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
