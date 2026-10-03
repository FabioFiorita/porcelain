import { encode } from 'uqr';
import { PAIRING_QR_BORDER_MODULES } from '@/config/limits';

export function PairingQr({ link }: { link: string }) {
  const { size, data } = encode(link, {
    ecc: 'M',
    border: PAIRING_QR_BORDER_MODULES,
  });
  const path = data
    .flatMap((row, y) =>
      row.flatMap((dark, x) => (dark ? [`M${x} ${y}h1v1h-1z`] : [])),
    )
    .join('');
  return (
    <svg
      role="img"
      aria-label="Pairing QR code"
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className="size-40 shrink-0 rounded-md bg-white text-black"
    >
      <path d={path} fill="currentColor" />
    </svg>
  );
}
