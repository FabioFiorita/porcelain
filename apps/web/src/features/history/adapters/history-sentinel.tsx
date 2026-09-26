import { HISTORY_LOAD_AHEAD_PX } from '@/config/limits';

export function HistorySentinel({
  enabled,
  onVisible,
}: {
  enabled: boolean;
  onVisible: () => void;
}) {
  return (
    <div
      aria-hidden="true"
      className="h-px"
      ref={(element) => {
        if (!element || !enabled || typeof IntersectionObserver === 'undefined')
          return;
        const observer = new IntersectionObserver(
          ([entry]) => {
            if (entry?.isIntersecting) onVisible();
          },
          { rootMargin: `0px 0px ${HISTORY_LOAD_AHEAD_PX}px 0px` },
        );
        observer.observe(element);
        return () => observer.disconnect();
      }}
    />
  );
}
