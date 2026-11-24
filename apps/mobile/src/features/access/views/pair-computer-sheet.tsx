import { Sheet } from '../../../components/ui/sheet';
import { usePairingSheetLink } from '../pairing-sheet';
import { PairEnvironmentForm } from './pair-environment-form';

export function PairComputerSheet({
  environmentId,
  onClose,
  onScan,
}: {
  environmentId?: string | undefined;
  onClose: () => void;
  onScan: () => void;
}) {
  const [link, setLink] = usePairingSheetLink();
  return (
    <Sheet title="Pair a computer">
      <PairEnvironmentForm
        layout="sheet"
        {...(environmentId ? { environmentId } : {})}
        link={link}
        onLinkChange={setLink}
        onClose={onClose}
        onScan={onScan}
      />
    </Sheet>
  );
}
