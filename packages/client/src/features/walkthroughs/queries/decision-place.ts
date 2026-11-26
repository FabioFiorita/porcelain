import { Option } from 'effect';
import { AsyncResult, Atom } from 'effect/reactivity';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { readDeviceLabels, readViewer } from '../../access/queries/viewer.ts';
import { decisionPlace, type Decider } from '../rules/page.ts';

type DecisionPlaceSelection = {
  readonly connection: RuntimeConnection;
  readonly decidedBy: Decider;
};

export const readDecisionPlace = Atom.family(
  ({ connection, decidedBy }: DecisionPlaceSelection) =>
    Atom.make((get) => {
      const viewer = Option.getOrUndefined(
        AsyncResult.value(get(readViewer(connection))),
      );
      const place = decisionPlace(decidedBy, viewer, undefined);
      if (place === undefined || decidedBy.kind === 'owner') return place;
      const labels = get(readDeviceLabels(connection));
      if (AsyncResult.isInitial(labels)) return undefined;
      return decisionPlace(
        decidedBy,
        viewer,
        Option.getOrUndefined(AsyncResult.value(labels)),
      );
    }),
);
