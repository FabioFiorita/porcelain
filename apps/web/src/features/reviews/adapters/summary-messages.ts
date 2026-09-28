import { type RefObject, useEffect } from 'react';
import { summaryLayerNumber } from '../rules/review';

export function useSummaryLayerRequests(
  frame: RefObject<HTMLIFrameElement | null>,
  onLayer: (layerNumber: number) => void,
) {
  useEffect(() => {
    const receive = (event: MessageEvent<unknown>) => {
      if (event.source !== frame.current?.contentWindow) return;
      const layerNumber = summaryLayerNumber(event.data);
      if (layerNumber !== null) onLayer(layerNumber);
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [frame, onLayer]);
}
