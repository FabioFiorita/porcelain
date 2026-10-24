import { Button } from '../../../components/ui/button';
import { ReviewBottomBar } from './review-bottom-bar';

export function BriefingContinue({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <ReviewBottomBar>
      <Button label={label} onPress={onPress} />
    </ReviewBottomBar>
  );
}
