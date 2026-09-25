import { cn } from 'cn';
import type { CssVariables } from '@/shared/lib/css-variables';

function AspectRatio({
  ratio,
  className,
  ...props
}: React.ComponentProps<'div'> & { ratio: number }) {
  const ratioStyle: CssVariables = { '--ratio': ratio };
  return (
    <div
      data-slot="aspect-ratio"
      style={ratioStyle}
      className={cn('relative aspect-(--ratio)', className)}
      {...props}
    />
  );
}

export { AspectRatio };
