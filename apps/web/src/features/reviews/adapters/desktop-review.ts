import { useEffect, useState } from 'react';

const desktopReviewQuery = '(min-width: 1280px)';

export function useDesktopReview() {
  const [desktop, setDesktop] = useState(
    () => window.matchMedia(desktopReviewQuery).matches,
  );
  useEffect(() => {
    const media = window.matchMedia(desktopReviewQuery);
    const update = () => setDesktop(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return desktop;
}
