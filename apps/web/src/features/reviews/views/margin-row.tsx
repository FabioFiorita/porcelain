import type { ReactNode } from 'react';

export function MarginRow({
  children,
  margin,
}: {
  children: ReactNode;
  margin?: ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-8 @5xl/review:grid-cols-[minmax(0,1fr)_--spacing(51)] @5xl/review:gap-7">
      <div className="min-w-0">{children}</div>
      {margin}
    </div>
  );
}
