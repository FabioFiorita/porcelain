import { Sheet } from '../../../components/ui/sheet';
import { usePairingSheetLink } from '../pairing-sheet';
import { PairEnvironmentForm } from './pair-environment-form';

export function PairComputerSheet({
  onClose,
  onScan,
}: {
  onClose: () => void;
  onScan: () => void;
}) {
  const [link, setLink] = usePairingSheetLink();
  return (
    <Sheet title="Pair a computer">
      <PairEnvironmentForm
        layout="sheet"
        link={link}
        onLinkChange={setLink}
        onClose={onClose}
        onScan={onScan}
      />
    </Sheet>
  );
}
