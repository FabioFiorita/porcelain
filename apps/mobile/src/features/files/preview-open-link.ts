import { runUserAction } from '@porcelain/shared/background'

/**
 * Open a tapped preview link in the system browser. Total void edge for WebView
 * navigation handlers that ignore returned promises.
 */
export function openPreviewExternalLink(
  url: string,
  openUrl: (href: string) => PromiseLike<unknown>,
  onError: (error: unknown) => void,
): void {
  runUserAction(() => openUrl(url), onError)
}
