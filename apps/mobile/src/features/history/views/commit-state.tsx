import { ErrorState } from '../../../components/ui/error-state';
import { Loading } from '../../../components/ui/loading';
export function CommitState({
  failed,
  retry,
}: {
  failed: boolean;
  retry: () => void;
}) {
  return failed ? (
    <ErrorState
      message="Couldn't load commit"
      retry={{ label: 'Retry', onPress: retry }}
    />
  ) : (
    <Loading label="Loading commit…" />
  );
}
