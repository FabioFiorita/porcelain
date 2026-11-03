import { Sheet } from '../../../components/ui/sheet';
import { PairEnvironmentForm } from './pair-environment-form';

export function PairComputerSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="Pair a computer">
      <PairEnvironmentForm layout="sheet" onClose={onClose} />
    </Sheet>
  );
}
