import { summaryLayerNumber } from '@porcelain/client/reviews/rules';

export function bindSummaryLayerRequests(
  frame: HTMLIFrameElement,
  onLayer: (layerNumber: number) => void,
) {
  const receive = (event: MessageEvent<unknown>) => {
    if (event.source !== frame.contentWindow) return;
    const layerNumber = summaryLayerNumber(event.data);
    if (layerNumber !== null) onLayer(layerNumber);
  };
  window.addEventListener('message', receive);
  return () => window.removeEventListener('message', receive);
}
