import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import type { RuntimeConnection } from '@porcelain/client/transport';
import { archiveOptions } from '@porcelain/client/preferences/rules';
import { Button } from '../../../components/ui/button';
import { ErrorState } from '../../../components/ui/error-state';
import { usePreferences } from '../../preferences';
import { useArchiveReview } from '../commands/archive-review';
export function ArchiveReview(props: {
  connection: RuntimeConnection;
  reviewId: string;
  projectId: string;
  mainWorktreeId: string;
}) {
  const { preferences, status } = usePreferences();
  const { result, prepare } = useArchiveReview(props);
  return (
    <>
      <Button
        label="Archive"
        variant="outline"
        disabled={status !== 'ready'}
        pending={result.waiting}
        onPress={() => {
          prepare(archiveOptions(preferences));
        }}
      />
      {AsyncResult.isFailure(result) ? (
        <ErrorState message={String(Cause.squash(result.cause))} />
      ) : null}
    </>
  );
}
