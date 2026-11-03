import type { ReactNode } from 'react';
import { Button } from '../../../components/ui/button';
import { ReviewBottomBar } from './review-bottom-bar';

export function BriefingContinue({
  next,
  onContinue,
  children,
}: {
  next: { label: string } | undefined;
  onContinue: () => void;
  children?: ReactNode;
}) {
  return (
    <ReviewBottomBar>
      {next ? <Button label={next.label} onPress={onContinue} /> : null}
      {children}
    </ReviewBottomBar>
  );
}
