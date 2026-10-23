import type { ReactNode } from 'react';

export function MarginRow({
  children,
  margin,
}: {
  children: ReactNode;
  margin?: ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-8 @5xl/review:grid-cols-4">
      <div className="min-w-0 @5xl/review:col-span-3">{children}</div>
      {margin}
    </div>
  );
}
